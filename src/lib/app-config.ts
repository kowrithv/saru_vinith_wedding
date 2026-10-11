import type Database from 'better-sqlite3'

const WRITES_LOCKED_KEY = 'writes_locked'

export function isWritesLocked(db: Database.Database): boolean {
  const row = db
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .get(WRITES_LOCKED_KEY) as { value: string } | undefined
  return row?.value === 'true'
}

export function setWritesLocked(db: Database.Database, locked: boolean): void {
  db.prepare(
    'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(WRITES_LOCKED_KEY, locked ? 'true' : 'false')
}
