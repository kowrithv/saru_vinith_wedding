import { createHmac } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { NextResponse } from 'next/server'
import { getOrCreateAdminSecret, isAdminRequest, signCookieValue, verifyCookieValue } from './admin-auth'
import { getGuestPassword, normalizeGuestPassword, verifyGuestPassword } from './guest-password'

export const GALLERY_COOKIE_NAME = 'gallery_session'
// Der Browser merkt sich das Kennwort für Galerie, Gästebuch und Erinnerungen
// so lange: die Seite soll auch nach der Feier ohne neue Eingabe aufgehen.
export const GALLERY_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 Tage

// Eigenständig von ADMIN_SECRET abgeleitet (nicht die rohe Secret selbst),
// damit ein Galerie-Cookie niemals auch als gültiges Admin-Cookie
// durchgeht - beide nutzen sonst exakt dasselbe Signier-Format
// (signCookieValue/verifyCookieValue), der Cookie-NAME allein trennt die
// beiden Zwecke nicht, da nur der Cookie-WERT signiert/geprüft wird.
//
// Das aktuelle Gäste-Kennwort fließt mit ein: ein Kennwortwechsel (Neustart
// mit neuem Wert) entwertet alle ausgestellten Sitzungen.
function deriveGallerySecret(adminSecret: string): string {
  const guestPassword = normalizeGuestPassword(getGuestPassword() ?? '')
  return createHmac('sha256', adminSecret)
    .update('gallery-session')
    .update('\0')
    .update(guestPassword)
    .digest('hex')
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

export function setGallerySessionCookie(response: NextResponse, db: Database.Database): void {
  response.cookies.set(GALLERY_COOKIE_NAME, createGallerySessionCookieValue(db), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(Date.now() + GALLERY_SESSION_DURATION_MS),
  })
}

/** Gast mit gültiger Sitzung oder Admin. Prüft kein Kennwort im Request. */
export function hasGuestAccess(request: Request, db: Database.Database): boolean {
  return isAdminRequest(request, db) || isGalleryUnlocked(request, db)
}

export type GuestAuthorization = { ok: true; issueSession: boolean } | { ok: false }

/**
 * Gemeinsame Prüfung für alles, was Gäste schreiben (Gästebuch, Erinnerungen,
 * Foto-Upload): gültige Sitzung genügt, sonst muss der Request das richtige
 * Kennwort tragen. Bei einem Kennwort soll die Antwort die Sitzung setzen
 * (`issueSession`), damit der Gast es nicht ein zweites Mal eingeben muss.
 */
export function authorizeGuest(
  request: Request,
  db: Database.Database,
  candidatePassword: unknown
): GuestAuthorization {
  if (hasGuestAccess(request, db)) return { ok: true, issueSession: false }
  if (
    typeof candidatePassword === 'string' &&
    verifyGuestPassword(candidatePassword, getGuestPassword())
  ) {
    return { ok: true, issueSession: true }
  }
  return { ok: false }
}
