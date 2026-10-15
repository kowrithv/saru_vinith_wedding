import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type Database from 'better-sqlite3'

export const ADMIN_COOKIE_NAME = 'admin_session'

export function hashPassword(password: string): string {
  return createHash('sha256').update(password, 'utf8').digest('hex')
}

export function verifyPassword(
  candidate: string,
  expectedPlain: string
): boolean {
  const candidateHash = Buffer.from(hashPassword(candidate), 'hex')
  const expectedHash = Buffer.from(hashPassword(expectedPlain), 'hex')
  return timingSafeEqual(candidateHash, expectedHash)
}

const ADMIN_SECRET_CONFIG_KEY = 'admin_secret'

export function getOrCreateAdminSecret(db: Database.Database): string {
  const envSecret = process.env.ADMIN_SECRET
  if (envSecret) {
    return envSecret
  }

  const row = db
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .get(ADMIN_SECRET_CONFIG_KEY) as { value: string } | undefined

  if (row) {
    return row.value
  }

  const generated = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO app_config (key, value) VALUES (?, ?)').run(
    ADMIN_SECRET_CONFIG_KEY,
    generated
  )
  return generated
}

export const ADMIN_SESSION_DURATION_MS = 12 * 60 * 60 * 1000 // 12h

/**
 * Schlüssel, mit dem Admin-Cookies signiert werden. Er hängt am Admin-Kennwort:
 * wer das Kennwort wechselt, beendet damit alle bestehenden Admin-Sitzungen
 * (sonst gälte ein altes Cookie bis zum Ablauf weiter). Vom Signierschlüssel der
 * Gast-Sitzungen und der Upload-Tickets ist er getrennt abgeleitet.
 */
export function adminCookieSecret(rawSecret: string): string {
  return createHmac('sha256', rawSecret)
    .update('admin-session')
    .update('\0')
    .update(process.env.ADMIN_PASSWORD ?? '')
    .digest('hex')
}

export function signCookieValue(expiresAt: number, secret: string): string {
  const signature = createHmac('sha256', secret)
    .update(String(expiresAt))
    .digest('hex')
  return `${expiresAt}.${signature}`
}

export function verifyCookieValue(
  value: string,
  secret: string,
  now: number = Date.now()
): boolean {
  const separatorIndex = value.indexOf('.')
  if (separatorIndex === -1) {
    return false
  }

  const expiresAtPart = value.slice(0, separatorIndex)
  const signaturePart = value.slice(separatorIndex + 1)
  const expiresAt = Number(expiresAtPart)
  if (!Number.isFinite(expiresAt)) {
    return false
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(expiresAtPart)
    .digest('hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  const actualBuffer = Buffer.from(signaturePart, 'hex')

  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
    return false
  }

  return expiresAt > now
}

export function isAdminRequest(request: Request, db: Database.Database): boolean {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return false

  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`))
  if (!match) return false

  const value = match.slice(ADMIN_COOKIE_NAME.length + 1)
  const secret = adminCookieSecret(getOrCreateAdminSecret(db))
  return verifyCookieValue(value, secret)
}
