import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

export function applySchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  db.exec(`
    CREATE TABLE IF NOT EXISTS who_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      option TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(question_id, voter_id)
    );

    CREATE TABLE IF NOT EXISTS gallery_photos (
      id TEXT PRIMARY KEY,
      thumb_key TEXT NOT NULL,
      original_key TEXT NOT NULL,
      uploader_name TEXT NOT NULL,
      delete_token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS guestbook_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS memories_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      photo_key TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

export function createDb(dbPath: string): Database.Database {
  // better-sqlite3 legt die Datei an, aber nicht das Verzeichnis darüber -
  // in Produktion übernimmt das bislang nur docker-entrypoint.sh (mkdir -p
  // ./data), lokale Entwicklung hatte dafür kein Äquivalent. ':memory:'
  // hat kein Verzeichnis - dirname liefert dann '.', ein harmloses No-Op.
  if (dbPath !== ':memory:') {
    mkdirSync(path.dirname(dbPath), { recursive: true })
  }
  const db = new Database(dbPath)
  applySchema(db)
  return db
}

declare global {
  var __appDb: Database.Database | undefined
}

export function getDb(): Database.Database {
  if (!globalThis.__appDb) {
    const path = process.env.DATABASE_PATH ?? 'data/wedding.db'
    globalThis.__appDb = createDb(path)
  }
  return globalThis.__appDb
}
