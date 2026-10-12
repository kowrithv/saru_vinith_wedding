import { createHmac } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getOrCreateAdminSecret, signCookieValue, verifyCookieValue } from './admin-auth'

export const GALLERY_COOKIE_NAME = 'gallery_session'
export const GALLERY_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 Tage

// Eigenständig von ADMIN_SECRET abgeleitet (nicht die rohe Secret selbst),
// damit ein Galerie-Cookie niemals auch als gültiges Admin-Cookie
// durchgeht - beide nutzen sonst exakt dasselbe Signier-Format
// (signCookieValue/verifyCookieValue), der Cookie-NAME allein trennt die
// beiden Zwecke nicht, da nur der Cookie-WERT signiert/geprüft wird.
function deriveGallerySecret(adminSecret: string): string {
  return createHmac('sha256', adminSecret).update('gallery-session').digest('hex')
}

export function createGallerySessionCookieValue(
  db: Database.Database,
  now: number = Date.now()
): string {
  const secret = deriveGallerySecret(getOrCreateAdminSecret(db))
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
  const secret = deriveGallerySecret(getOrCreateAdminSecret(db))
  return verifyCookieValue(value, secret)
}
