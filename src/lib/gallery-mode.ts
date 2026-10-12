import type Database from 'better-sqlite3'

export type GalleryMode = 'public' | 'password'

const GALLERY_MODE_KEY = 'gallery_mode'

export function getGalleryMode(db: Database.Database): GalleryMode {
  const row = db
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .get(GALLERY_MODE_KEY) as { value: string } | undefined
  return row?.value === 'password' ? 'password' : 'public'
}

export function setGalleryMode(db: Database.Database, mode: GalleryMode): void {
  db.prepare(
    'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(GALLERY_MODE_KEY, mode)
}
