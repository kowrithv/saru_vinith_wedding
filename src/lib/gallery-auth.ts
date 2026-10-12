import type Database from 'better-sqlite3'
import { getOrCreateAdminSecret, signCookieValue, verifyCookieValue } from './admin-auth'

export const GALLERY_COOKIE_NAME = 'gallery_session'
export const GALLERY_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 Tage

export function createGallerySessionCookieValue(
  db: Database.Database,
  now: number = Date.now()
): string {
  const secret = getOrCreateAdminSecret(db)
  return signCookieValue(now + GALLERY_SESSION_DURATION_MS, secret)
}

export function isGalleryUnlocked(request: Request, db: Database.Database): boolean {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return false

  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GALLERY_COOKIE_NAME}=`))
  if (!match) return false

  const value = match.slice(GALLERY_COOKIE_NAME.length + 1)
  const secret = getOrCreateAdminSecret(db)
  return verifyCookieValue(value, secret)
}
