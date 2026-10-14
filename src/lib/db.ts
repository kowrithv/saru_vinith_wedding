import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return columns.some((col) => col.name === column)
}

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
      category TEXT NOT NULL DEFAULT 'Hochzeit',
      is_official INTEGER NOT NULL DEFAULT 0,
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
      photo_id TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Jedes gemeldete Memory-Ergebnis (ohne Namen). Der Rekord ist das beste
    -- davon; der Admin kann einzelne unmögliche Werte entfernen.
    CREATE TABLE IF NOT EXISTS memory_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      moves INTEGER NOT NULL,
      seconds INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_memory_results_rank ON memory_results (moves, seconds, id);
  `)

  // Ein Rekord im alten Format (zwei app_config-Schlüssel) wird einmalig als
  // Ergebnis übernommen; die Schlüssel verschwinden danach. Idempotent.
  db.exec(`
    INSERT INTO memory_results (moves, seconds)
    SELECT CAST(m.value AS INTEGER), CAST(s.value AS INTEGER)
    FROM app_config m, app_config s
    WHERE m.key = 'memory_record_moves' AND s.key = 'memory_record_seconds'
      AND CAST(m.value AS INTEGER) > 0 AND CAST(s.value AS INTEGER) > 0
      AND NOT EXISTS (SELECT 1 FROM memory_results);
    DELETE FROM app_config WHERE key IN ('memory_record_moves', 'memory_record_seconds');
  `)

  // Migration für gallery_photos-Tabellen, die vor dieser Erweiterung
  // angelegt wurden - CREATE TABLE IF NOT EXISTS legt die neuen Spalten
  // nur bei einer brandneuen Tabelle an. Idempotent, da applySchema bei
  // jedem createDb()-Aufruf erneut läuft.
  if (!columnExists(db, 'gallery_photos', 'category')) {
    db.exec(`ALTER TABLE gallery_photos ADD COLUMN category TEXT NOT NULL DEFAULT 'Hochzeit'`)
  }
  if (!columnExists(db, 'gallery_photos', 'is_official')) {
    db.exec(`ALTER TABLE gallery_photos ADD COLUMN is_official INTEGER NOT NULL DEFAULT 0`)
  }
  // Fotos zu Erinnerungen: Verweis auf gallery_photos.id (photo_key bleibt
  // ungenutzt). Kein Fremdschlüssel: ein in der Galerie gelöschtes Foto soll
  // die Erinnerung nicht blockieren, sie zeigt dann nur den Text.
  if (!columnExists(db, 'memories_entries', 'photo_id')) {
    db.exec(`ALTER TABLE memories_entries ADD COLUMN photo_id TEXT`)
  }
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
