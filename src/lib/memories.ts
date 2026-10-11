import type Database from 'better-sqlite3'

export interface MemoryEntry {
  id: number
  name: string
  message: string
  photoKey: string | null
  createdAt: string
}

interface MemoryRow {
  id: number
  name: string
  message: string
  photo_key: string | null
  created_at: string
}

function toEntry(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    photoKey: row.photo_key,
    createdAt: row.created_at,
  }
}

export function addMemoryEntry(
  db: Database.Database,
  name: string,
  message: string,
  photoKey: string | null
): MemoryEntry {
  const result = db
    .prepare('INSERT INTO memories_entries (name, message, photo_key) VALUES (?, ?, ?)')
    .run(name, message, photoKey)
  const row = db
    .prepare('SELECT id, name, message, photo_key, created_at FROM memories_entries WHERE id = ?')
    .get(result.lastInsertRowid) as MemoryRow
  return toEntry(row)
}

export function listMemoryEntries(db: Database.Database): MemoryEntry[] {
  const rows = db
    .prepare('SELECT id, name, message, photo_key, created_at FROM memories_entries ORDER BY id DESC')
    .all() as MemoryRow[]
  return rows.map(toEntry)
}

export function deleteMemoryEntry(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM memories_entries WHERE id = ?').run(id)
  return result.changes > 0
}
