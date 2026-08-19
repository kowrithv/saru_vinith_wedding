import { createHmac, timingSafeEqual } from 'crypto'

export const ADMIN_COOKIE_NAME = 'admin_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 12 // 12h

function getSecret(): string {
  return process.env.ADMIN_SECRET || 'dev-secret-change-me'
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export function createSessionCookieValue(): string {
  const expiresAt = String(Date.now() + SESSION_TTL_MS)
  return `${expiresAt}.${sign(expiresAt)}`
}

export function isValidSession(cookieValue: string | undefined | null): boolean {
  if (!cookieValue) return false
  const [expiresAt, signature] = cookieValue.split('.')
  if (!expiresAt || !signature) return false

  const expectedSignature = sign(expiresAt)
  const a = Buffer.from(signature)
  const b = Buffer.from(expectedSignature)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  return Number(expiresAt) > Date.now()
}

export function isCorrectPassword(candidate: string): boolean {
  const actual = process.env.ADMIN_PASSWORD || ''
  if (!actual) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(actual)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
