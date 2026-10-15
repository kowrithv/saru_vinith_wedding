import { createHmac, timingSafeEqual } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getOrCreateAdminSecret, isAdminRequest } from './admin-auth'
import { getConfigValue, isFeatureLocked, setConfigValue, setFeatureLocked } from './app-config'
import { getClientKey } from './client-ip'
import { RateLimiter } from './rate-limit'
import { normalizeResultsCode } from './who-results-code'
import { RESULTS_WORDS } from './who-results-words'

// "Wer von uns?": Die Ergebnisse bleiben verborgen, bis das Brautpaar die
// Auflösung freigibt. Der DJ sieht sie vorher mit einem Wort.

const RELEASED_CONFIG_KEY = 'who_results_released'

/** Header, mit dem die DJ-Seite das Wort mitschickt. */
export const RESULTS_KEY_HEADER = 'x-results-key'

export function areResultsReleased(db: Database.Database): boolean {
  return getConfigValue(db, RELEASED_CONFIG_KEY) === 'true'
}

export function setResultsReleased(db: Database.Database, released: boolean): void {
  setConfigValue(db, RELEASED_CONFIG_KEY, released ? 'true' : 'false')
}

/**
 * Die drei Zustände der Abstimmung:
 * - `voting`: die Gäste stimmen ab, die Ergebnisse sind verborgen,
 * - `closed`: die Abstimmung ist beendet, die Ergebnisse sind weiter verborgen,
 * - `released`: die Ergebnisse sind für die Gäste freigegeben.
 * Der DJ sieht die Ergebnisse in jedem Zustand.
 */
export type WhoPhase = 'voting' | 'closed' | 'released'

export const WHO_PHASES: readonly WhoPhase[] = ['voting', 'closed', 'released']

// "Beendet" ist die bestehende Schreib-Sperre für die Abstimmung: so bleibt
// eine Sperre über die alte Schnittstelle dasselbe wie der Zustand "beendet".
export function getWhoPhase(db: Database.Database): WhoPhase {
  if (areResultsReleased(db)) return 'released'
  return isFeatureLocked(db, 'who_votes') ? 'closed' : 'voting'
}

export function setWhoPhase(db: Database.Database, phase: WhoPhase): void {
  db.transaction(() => {
    setFeatureLocked(db, 'who_votes', phase !== 'voting')
    setResultsReleased(db, phase === 'released')
  })()
}

/**
 * Das Wort für die DJ-Seite, aus dem Admin-Schlüssel abgeleitet (nichts zu
 * speichern, stabil über Neustarts, mit eigener Bezeichnung: es taugt weder als
 * Admin-Cookie noch als Gäste-Sitzung und gibt nur die Ergebnisse frei). Es ist
 * ein leicht tippbares Wort, also kein starkes Geheimnis: es hält Gäste davon ab,
 * vorab in die Zwischenstände zu schauen, und Raten wird unten gebremst.
 */
export function resultsKey(db: Database.Database): string {
  const digest = createHmac('sha256', getOrCreateAdminSecret(db)).update('who-results-link').digest()
  return RESULTS_WORDS[digest.readUInt32BE(0) % RESULTS_WORDS.length]
}

function isValidResultsKey(db: Database.Database, candidate: string): boolean {
  // Die Form zuerst prüfen: eine Eingabe kann in Groß- oder Kleinschreibung
  // und mit Leerzeichen am Rand kommen.
  const normalized = normalizeResultsCode(candidate)
  if (normalized === null) return false
  const expected = Buffer.from(resultsKey(db), 'utf8')
  const actual = Buffer.from(normalized, 'utf8')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// --- Falsche Wörter ---------------------------------------------------------
//
// Ein Wort ist leicht zu tippen und leicht zu erraten, deshalb wird das Raten
// gebremst: je Adresse nur wenige Fehlversuche in 15 Minuten. Das richtige Wort
// wird nie abgewiesen (wie beim Gäste-Kennwort), damit niemand den DJ aussperren
// kann, auch nicht aus demselben WLAN.

const WRONG_CODE_LIMIT = 20
const WRONG_CODE_WINDOW_MS = 15 * 60 * 1000

declare global {
  var __resultsCodeFailures: RateLimiter | undefined
}

function failures(): RateLimiter {
  globalThis.__resultsCodeFailures ??= new RateLimiter({
    maxAttempts: WRONG_CODE_LIMIT,
    windowMs: WRONG_CODE_WINDOW_MS,
  })
  return globalThis.__resultsCodeFailures
}

export type ResultsAccess =
  /** Admin oder richtiges Wort: die Zwischenstände dürfen gezeigt werden. */
  | { kind: 'allowed' }
  /** Kein oder falsches Wort: die Zwischenstände bleiben verborgen. */
  | { kind: 'hidden'; codeGiven: boolean }
  /** Zu viele falsche Wörter von dieser Adresse. */
  | { kind: 'blocked'; retryAfterSeconds: number }

/** Darf diese Anfrage die Zwischenstände sehen (Admin oder DJ-Wort)? */
export function resultsAccess(request: Request, db: Database.Database): ResultsAccess {
  if (isAdminRequest(request, db)) return { kind: 'allowed' }

  const candidate = request.headers.get(RESULTS_KEY_HEADER)
  // Ohne Wort (Gäste fragen so alle paar Sekunden den Stand) wird nichts gezählt.
  if (candidate === null || candidate.trim() === '') return { kind: 'hidden', codeGiven: false }
  if (isValidResultsKey(db, candidate)) return { kind: 'allowed' }

  const limit = failures().check(getClientKey(request))
  if (!limit.allowed) {
    return { kind: 'blocked', retryAfterSeconds: Math.max(1, Math.ceil(limit.retryAfterMs / 1000)) }
  }
  return { kind: 'hidden', codeGiven: true }
}

/** Kurzform für Aufrufer, die nur ja oder nein brauchen. */
export function canSeeResults(request: Request, db: Database.Database): boolean {
  return resultsAccess(request, db).kind === 'allowed'
}
