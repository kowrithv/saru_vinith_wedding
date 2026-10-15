import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { GALLERY_COOKIE_NAME, authorizeGuest, isGalleryUnlocked } from './gallery-auth'
import { getClientKey } from './client-ip'
import { RateLimiter, type RateLimitResult } from './rate-limit'

// Auf einer Feier teilen sich viele Gäste die Adresse des WLANs oder des
// Mobilfunknetzes: eine Grenze je Adresse träfe alle zugleich. Gezählt wird
// deshalb je Gerät (die Sitzung aus dem Kennwort); nur ohne Sitzung - etwa beim
// allerersten Eintrag mit Kennwort - bleibt die Adresse, mit großzügigem Wert.

function sessionValue(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  const match = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GALLERY_COOKIE_NAME}=`))
  return match ? match.slice(GALLERY_COOKIE_NAME.length + 1) : null
}

/** Schlüssel für die Limits: `s:<Kurzform der Sitzung>` oder `ip:<Adresse>`. */
export function guestLimitKey(request: Request, db: Database.Database): string {
  const value = sessionValue(request)
  // Nur eine gültige Sitzung zählt: ein erfundener Wert wäre sonst jedes Mal
  // ein frisches Kontingent.
  if (value && isGalleryUnlocked(request, db)) {
    return `s:${createHash('sha256').update(value).digest('hex').slice(0, 24)}`
  }
  return `ip:${getClientKey(request)}`
}

interface GuestRateLimiterOptions {
  /** Kontingent je Gerät mit Sitzung. */
  perDevice: number
  /** Kontingent je Adresse für Anfragen ohne Sitzung (großzügig: gemeinsames WLAN). */
  perAddress: number
  windowMs: number
}

export class GuestRateLimiter {
  private readonly devices: RateLimiter
  private readonly addresses: RateLimiter

  constructor({ perDevice, perAddress, windowMs }: GuestRateLimiterOptions) {
    this.devices = new RateLimiter({ maxAttempts: perDevice, windowMs })
    this.addresses = new RateLimiter({ maxAttempts: perAddress, windowMs })
  }

  check(request: Request, db: Database.Database, cost = 1): RateLimitResult {
    const key = guestLimitKey(request, db)
    return key.startsWith('s:') ? this.devices.check(key, cost) : this.addresses.check(key, cost)
  }
}

// --- Falsche Kennwörter -----------------------------------------------------
//
// Das Kennwort ist ein einfaches Wort (steht auf dem Flyer): die Grenze hält nur
// lautes Probieren auf, einen gezielten Rater hält sie nicht auf. Wichtig ist
// deshalb das Gegenteil - sie darf nie Gäste aussperren: ein RICHTIGES Kennwort
// wird nie abgewiesen, gezählt werden nur falsche, und zwar für alle Wege
// zusammen (Entsperren, Gästebuch, Erinnerungen, Upload) je Adresse.

const WRONG_PASSWORD_LIMIT = 20
const WRONG_PASSWORD_WINDOW_MS = 15 * 60 * 1000

declare global {
  var __guestPasswordFailures: RateLimiter | undefined
}

// Als globalThis-Singleton: jede Route soll dieselbe Zählung sehen (wie die
// Datenbank in db.ts).
function failures(): RateLimiter {
  globalThis.__guestPasswordFailures ??= new RateLimiter({
    maxAttempts: WRONG_PASSWORD_LIMIT,
    windowMs: WRONG_PASSWORD_WINDOW_MS,
  })
  return globalThis.__guestPasswordFailures
}

export type WrongPassword =
  | { ok: false; status: 401; error: string }
  | { ok: false; status: 429; error: string; retryAfterSeconds: number }

/** Verbucht einen Fehlversuch dieser Adresse und liefert die passende Antwort. */
export function registerWrongPassword(request: Request): WrongPassword {
  const limit = failures().check(getClientKey(request))
  if (limit.allowed) return { ok: false, status: 401, error: 'Falsches Kennwort.' }

  const seconds = Math.max(1, Math.ceil(limit.retryAfterMs / 1000))
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  return {
    ok: false,
    status: 429,
    error: `Zu viele Versuche. Bitte in etwa ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'} erneut versuchen.`,
    retryAfterSeconds: seconds,
  }
}

export type GuestGate = { ok: true; issueSession: boolean } | WrongPassword

/**
 * Gast mit gültiger Sitzung oder mit dem richtigen Kennwort im Request:
 * durchgelassen, ohne jede Zählung. Sonst ein Fehlversuch (401 oder 429).
 */
export function gateGuest(request: Request, db: Database.Database, candidatePassword: unknown): GuestGate {
  const access = authorizeGuest(request, db, candidatePassword)
  if (access.ok) return { ok: true, issueSession: access.issueSession }
  return registerWrongPassword(request)
}
