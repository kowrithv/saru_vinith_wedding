import type Database from 'better-sqlite3'
import { getConfigValue, setConfigValue } from '@/lib/app-config'
import { MEMORY_PAIRS_COUNT } from '@/lib/memory-content'

export interface MemoryResult {
  moves: number
  seconds: number
}

export interface SubmitOutcome {
  record: MemoryResult
  isNewRecord: boolean
}

// Plausibilitätsgrenzen für gemeldete Ergebnisse. Ohne Namen gibt es keine
// echte Fälschungssicherung; die Grenzen halten nur plumpe Werte ab, die das
// Spiel nie liefern kann (ein Paar braucht mindestens einen Zug, und jeder
// Zug hat eine Auflösungspause von mindestens einer halben Sekunde).
export const MIN_MOVES = MEMORY_PAIRS_COUNT
export const MAX_MOVES = 500
export const MIN_SECONDS = 4
export const MAX_SECONDS = 5999

const MOVES_KEY = 'memory_record_moves'
const SECONDS_KEY = 'memory_record_seconds'

/** Weniger Züge sind besser; bei gleich vielen Zügen die kürzere Zeit. */
export function isBetterResult(candidate: MemoryResult, current: MemoryResult | null): boolean {
  if (!current) return true
  if (candidate.moves !== current.moves) return candidate.moves < current.moves
  return candidate.seconds < current.seconds
}

export function getMemoryRecord(db: Database.Database): MemoryResult | null {
  const moves = Number(getConfigValue(db, MOVES_KEY))
  const seconds = Number(getConfigValue(db, SECONDS_KEY))
  if (!Number.isInteger(moves) || !Number.isInteger(seconds) || moves <= 0 || seconds <= 0) return null
  return { moves, seconds }
}

/**
 * Meldet ein Ergebnis und ersetzt den Rekord, falls es besser ist. Lesen und
 * Schreiben laufen in einer Transaktion mit sofortiger Schreibsperre, damit
 * gleichzeitig beendete Spiele einander nicht überschreiben.
 */
export function submitMemoryResult(db: Database.Database, result: MemoryResult): SubmitOutcome {
  const apply = db.transaction((candidate: MemoryResult): SubmitOutcome => {
    const current = getMemoryRecord(db)
    if (isBetterResult(candidate, current)) {
      setConfigValue(db, MOVES_KEY, String(candidate.moves))
      setConfigValue(db, SECONDS_KEY, String(candidate.seconds))
      return { record: candidate, isNewRecord: true }
    }
    return { record: current as MemoryResult, isNewRecord: false }
  })
  return apply.immediate(result)
}

export function resetMemoryRecord(db: Database.Database): void {
  db.prepare('DELETE FROM app_config WHERE key IN (?, ?)').run(MOVES_KEY, SECONDS_KEY)
}
