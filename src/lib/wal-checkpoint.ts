import type Database from 'better-sqlite3'

export interface CheckpointResult {
  /** 1, wenn ein Leser das vollständige Zurücksetzen verhindert hat. */
  busy: number
  log: number
  checkpointed: number
}

/**
 * Überträgt das Write-ahead-Log in die Datenbankdatei und setzt es zurück.
 * SQLite tut das von selbst nur, wenn kurz kein Leser aktiv ist; bei dauernd
 * pollenden Gästen wächst das Log sonst den ganzen Abend. Bei einem Leser
 * meldet das Ergebnis `busy: 1`, nichts geht verloren: der nächste Lauf holt es nach.
 */
export function checkpointWal(db: Database.Database): CheckpointResult {
  const rows = db.pragma('wal_checkpoint(TRUNCATE)') as CheckpointResult[]
  return rows[0] ?? { busy: 0, log: 0, checkpointed: 0 }
}
