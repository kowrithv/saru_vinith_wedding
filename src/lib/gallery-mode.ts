import type Database from 'better-sqlite3'

export type GalleryMode = 'public' | 'password'

const GALLERY_MODE_KEY = 'gallery_mode'

// Standard ist "password": die Galerie öffnet sich erst, wenn der Browser
// entsperrt ist (QR-Link oder Kennwort). Ein bewusst gesetztes "public"
// bleibt erhalten.
export function getGalleryMode(db: Database.Database): GalleryMode {
  const row = db
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .get(GALLERY_MODE_KEY) as { value: string } | undefined
  return row?.value === 'public' ? 'public' : 'password'
}

export function setGalleryMode(db: Database.Database, mode: GalleryMode): void {
  db.prepare(
    'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(GALLERY_MODE_KEY, mode)
}
