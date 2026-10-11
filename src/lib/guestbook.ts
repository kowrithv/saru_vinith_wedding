import type Database from 'better-sqlite3'

export interface GuestbookEntry {
  id: number
  name: string
  message: string
  createdAt: string
}

interface GuestbookRow {
  id: number
  name: string
  message: string
  created_at: string
}

function toEntry(row: GuestbookRow): GuestbookEntry {
  return { id: row.id, name: row.name, message: row.message, createdAt: row.created_at }
}

export function addGuestbookEntry(
  db: Database.Database,
  name: string,
  message: string
): GuestbookEntry {
  const result = db
    .prepare('INSERT INTO guestbook_entries (name, message) VALUES (?, ?)')
    .run(name, message)
  const row = db
    .prepare('SELECT id, name, message, created_at FROM guestbook_entries WHERE id = ?')
    .get(result.lastInsertRowid) as GuestbookRow
  return toEntry(row)
}

export function listGuestbookEntries(db: Database.Database): GuestbookEntry[] {
  const rows = db
    .prepare('SELECT id, name, message, created_at FROM guestbook_entries ORDER BY id DESC')
    .all() as GuestbookRow[]
  return rows.map(toEntry)
}

export function deleteGuestbookEntry(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM guestbook_entries WHERE id = ?').run(id)
  return result.changes > 0
}
