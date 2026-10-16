import { createHmac } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { NextResponse } from 'next/server'
import { getOrCreateAdminSecret, signCookieValue, verifyCookieValue } from './admin-auth'
import { getScorePassword } from './env'
import { normalizeGuestPassword, verifyGuestPassword } from './guest-password'

export const SCORE_COOKIE_NAME = 'score_session'
// Der Beamer wird oft am Vortag eingerichtet und soll am Festtag nicht mitten in der
// Feier nach dem Kennwort fragen.
export const SCORE_SESSION_DURATION_MS = 3 * 24 * 60 * 60 * 1000 // 3 Tage

export function isScoreConfigured(): boolean {
  return getScorePassword() !== undefined
}

/** Wie beim Gäste-Kennwort: Groß-/Kleinschreibung und Leerzeichen am Rand zählen nicht. */
export function verifyScorePassword(candidate: string): boolean {
  return verifyGuestPassword(candidate, getScorePassword())
}

// Eigener, abgeleiteter Schlüssel (nicht der rohe Admin-Schlüssel): ein Beamer-Cookie
// geht so nie als Admin- oder Galerie-Cookie durch, obwohl alle dasselbe Signier-Format
// nutzen. Das Beamer-Kennwort fließt mit ein: ein Wechsel entwertet alte Sitzungen.
function deriveScoreSecret(adminSecret: string): string {
  return createHmac('sha256', adminSecret)
    .update('score-session')
    .update('\0')
    .update(normalizeGuestPassword(getScorePassword() ?? ''))
    .digest('hex')
}

export function createScoreSessionCookieValue(db: Database.Database, now: number = Date.now()): string {
  return signCookieValue(now + SCORE_SESSION_DURATION_MS, deriveScoreSecret(getOrCreateAdminSecret(db)))
}

/** Gültige Beamer-Sitzung. Der Admin hat hier keinen Sonderzugang: das Kennwort ist ein anderes. */
export function hasScoreAccess(request: Request, db: Database.Database): boolean {
  if (!isScoreConfigured()) return false
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return false

  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SCORE_COOKIE_NAME}=`))
  if (!match) return false

  const value = match.slice(SCORE_COOKIE_NAME.length + 1)
  return verifyCookieValue(value, deriveScoreSecret(getOrCreateAdminSecret(db)))
}

export function setScoreSessionCookie(response: NextResponse, db: Database.Database): void {
  response.cookies.set(SCORE_COOKIE_NAME, createScoreSessionCookieValue(db), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(Date.now() + SCORE_SESSION_DURATION_MS),
  })
}
