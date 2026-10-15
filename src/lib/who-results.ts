import { createHmac, timingSafeEqual } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getOrCreateAdminSecret, isAdminRequest } from './admin-auth'
import { getConfigValue, setConfigValue } from './app-config'

// "Wer von uns?": Die Ergebnisse bleiben verborgen, bis das Brautpaar die
// Auflösung freigibt. Der DJ sieht sie vorher über einen eigenen Lese-Link.

const RELEASED_CONFIG_KEY = 'who_results_released'

/** Header, mit dem die DJ-Seite den Schlüssel aus dem Link mitschickt. */
export const RESULTS_KEY_HEADER = 'x-results-key'

// 24 Hex-Zeichen = 96 Bit: nicht zu erraten, und der Link bleibt kurz.
const KEY_LENGTH = 24
const HEX_KEY_PATTERN = /^[0-9a-f]{24}$/

export function areResultsReleased(db: Database.Database): boolean {
  return getConfigValue(db, RELEASED_CONFIG_KEY) === 'true'
}

export function setResultsReleased(db: Database.Database, released: boolean): void {
  setConfigValue(db, RELEASED_CONFIG_KEY, released ? 'true' : 'false')
}

/**
 * Schlüssel im Lese-Link für den DJ. Aus dem Admin-Schlüssel abgeleitet (nichts
 * zu speichern, stabil über Neustarts), mit eigener Bezeichnung: er taugt weder
 * als Admin-Cookie noch als Gäste-Sitzung und gibt nur die Ergebnisse frei.
 */
export function resultsKey(db: Database.Database): string {
  return createHmac('sha256', getOrCreateAdminSecret(db))
    .update('who-results-link')
    .digest('hex')
    .slice(0, KEY_LENGTH)
}

function isValidResultsKey(db: Database.Database, candidate: string | null): boolean {
  // Format zuerst prüfen: Buffer.from(x, 'hex') schneidet ungültige Zeichen still ab.
  if (!candidate || !HEX_KEY_PATTERN.test(candidate)) return false
  const expected = Buffer.from(resultsKey(db), 'hex')
  const actual = Buffer.from(candidate, 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** Darf diese Anfrage die Ergebnisse vor der Freigabe sehen (DJ-Link oder Admin)? */
export function canSeeResults(request: Request, db: Database.Database): boolean {
  return (
    isValidResultsKey(db, request.headers.get(RESULTS_KEY_HEADER)) || isAdminRequest(request, db)
  )
}
