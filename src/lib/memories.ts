import type Database from 'better-sqlite3'

/** Das Galerie-Foto einer Erinnerung (Schlüssel nur serverseitig, siehe memories-view). */
export interface MemoryPhoto {
  id: string
  thumbKey: string
  originalKey: string
}

export interface MemoryEntry {
  id: number
  name: string
  message: string
  /** null: kein Foto angehängt oder das Foto wurde aus der Galerie gelöscht. */
  photo: MemoryPhoto | null
  createdAt: string
}

interface MemoryRow {
  id: number
  name: string
  message: string
  created_at: string
  photo_id: string | null
  thumb_key: string | null
  original_key: string | null
}

// LEFT JOIN: ein gelöschtes Galerie-Foto lässt die Zeile bestehen, die
// Schlüssel sind dann NULL.
const SELECT_ENTRY = `
  SELECT m.id, m.name, m.message, m.created_at,
         g.id AS photo_id, g.thumb_key, g.original_key
  FROM memories_entries m
  LEFT JOIN gallery_photos g ON g.id = m.photo_id`

function toEntry(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    photo:
      row.photo_id && row.thumb_key && row.original_key
        ? { id: row.photo_id, thumbKey: row.thumb_key, originalKey: row.original_key }
        : null,
    createdAt: row.created_at,
  }
}

export function addMemoryEntry(
  db: Database.Database,
  name: string,
  message: string,
  photoId: string | null
): MemoryEntry {
  const result = db
    .prepare('INSERT INTO memories_entries (name, message, photo_id) VALUES (?, ?, ?)')
    .run(name, message, photoId)
  return getMemoryEntry(db, Number(result.lastInsertRowid)) as MemoryEntry
}

export function getMemoryEntry(db: Database.Database, id: number): MemoryEntry | undefined {
  const row = db.prepare(`${SELECT_ENTRY} WHERE m.id = ?`).get(id) as MemoryRow | undefined
  return row ? toEntry(row) : undefined
}

/** Neueste zuerst; mit `limit` nur die neuesten (Obergrenze für die Antwort). */
export function listMemoryEntries(db: Database.Database, limit?: number): MemoryEntry[] {
  const rows = db.prepare(`${SELECT_ENTRY} ORDER BY m.id DESC LIMIT ?`).all(limit ?? -1) as MemoryRow[]
  return rows.map(toEntry)
}

export function deleteMemoryEntry(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM memories_entries WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * Kurzer Stand: Anzahl, höchste Kennung und wie viele Einträge ein sichtbares Foto haben
 * (ein aus der Galerie gelöschtes Foto lässt den Eintrag stehen, ändert ihn aber).
 */
export function memoriesFingerprint(db: Database.Database): string {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(MAX(m.id), 0) AS newest, COALESCE(SUM(g.id IS NOT NULL), 0) AS photos
       FROM memories_entries m LEFT JOIN gallery_photos g ON g.id = m.photo_id`
    )
    .get() as { count: number; newest: number; photos: number }
  return `${row.count}:${row.newest}:${row.photos}`
}
