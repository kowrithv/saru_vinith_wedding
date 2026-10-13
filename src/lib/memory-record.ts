import type Database from 'better-sqlite3'
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

// Obergrenze der gespeicherten Ergebnisse: ein Skript soll die Tabelle nicht
// beliebig füllen können (jede Sicherung kopiert sie mit). 100.000 Zeilen sind
// rund 5 MB und für ehrliches Spielen unerreichbar - ein einzelnes Skript
// bräuchte mit dem Limit von 600 Meldungen je 15 Minuten rund 42 Stunden.
// Bei Überschreitung fallen die schlechtesten weg, der Rekord und die Spitze
// der Liste bleiben also erhalten.
export const MAX_STORED_RESULTS = 100_000

const RANK_ORDER = 'moves ASC, seconds ASC, id ASC'

export interface StoredMemoryResult extends MemoryResult {
  id: number
  createdAt: string
}

/** Weniger Züge sind besser; bei gleich vielen Zügen die kürzere Zeit. */
export function isBetterResult(candidate: MemoryResult, current: MemoryResult | null): boolean {
  if (!current) return true
  if (candidate.moves !== current.moves) return candidate.moves < current.moves
  return candidate.seconds < current.seconds
}

/** Der Rekord ist das beste gespeicherte Ergebnis (bei Gleichstand das früheste). */
export function getMemoryRecord(db: Database.Database): MemoryResult | null {
  const row = db
    .prepare(`SELECT moves, seconds FROM memory_results ORDER BY ${RANK_ORDER} LIMIT 1`)
    .get() as MemoryResult | undefined
  return row ?? null
}

/**
 * Speichert ein gemeldetes Ergebnis. Der Rekord ist danach das beste aller
 * gespeicherten Ergebnisse. Schreiben und Prüfen laufen in einer Transaktion
 * mit sofortiger Schreibsperre, damit gleichzeitig beendete Spiele einander
 * nicht in die Quere kommen.
 */
export function submitMemoryResult(
  db: Database.Database,
  result: MemoryResult,
  maxStored: number = MAX_STORED_RESULTS
): SubmitOutcome {
  const apply = db.transaction((candidate: MemoryResult): SubmitOutcome => {
    const current = getMemoryRecord(db)
    db.prepare('INSERT INTO memory_results (moves, seconds) VALUES (?, ?)').run(candidate.moves, candidate.seconds)

    const { n } = db.prepare('SELECT COUNT(*) AS n FROM memory_results').get() as { n: number }
    if (n > maxStored) {
      db.prepare(
        `DELETE FROM memory_results WHERE id IN (
           SELECT id FROM memory_results ORDER BY ${RANK_ORDER} LIMIT -1 OFFSET ?
         )`
      ).run(maxStored)
    }

    const isNewRecord = isBetterResult(candidate, current)
    return { record: isNewRecord ? candidate : (current as MemoryResult), isNewRecord }
  })
  return apply.immediate(result)
}

/** Die besten gespeicherten Ergebnisse (für den Admin) und die Gesamtzahl. */
export function listMemoryResults(
  db: Database.Database,
  limit = 50
): { results: StoredMemoryResult[]; total: number } {
  const results = db
    .prepare(`SELECT id, moves, seconds, created_at AS createdAt FROM memory_results ORDER BY ${RANK_ORDER} LIMIT ?`)
    .all(limit) as StoredMemoryResult[]
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM memory_results').get() as { n: number }
  return { results, total: n }
}

export function deleteMemoryResult(db: Database.Database, id: number): boolean {
  return db.prepare('DELETE FROM memory_results WHERE id = ?').run(id).changes > 0
}

export function resetMemoryRecord(db: Database.Database): void {
  db.prepare('DELETE FROM memory_results').run()
}
