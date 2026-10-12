import type Database from 'better-sqlite3'

export const LOCKABLE_FEATURES = ['guestbook', 'memories', 'who_votes', 'gallery_upload'] as const
export type LockableFeature = (typeof LOCKABLE_FEATURES)[number]

const LOCK_KEYS: Record<LockableFeature, string> = {
  guestbook: 'guestbook_locked',
  memories: 'memories_locked',
  who_votes: 'who_votes_locked',
  gallery_upload: 'gallery_upload_locked',
}

export function isFeatureLocked(db: Database.Database, feature: LockableFeature): boolean {
  const row = db
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .get(LOCK_KEYS[feature]) as { value: string } | undefined
  return row?.value === 'true'
}

export function setFeatureLocked(db: Database.Database, feature: LockableFeature, locked: boolean): void {
  db.prepare(
    'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(LOCK_KEYS[feature], locked ? 'true' : 'false')
}
