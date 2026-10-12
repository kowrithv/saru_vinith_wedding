import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { applySchema, createDb, getDb } from './db'

describe('createDb', () => {
  it('creates all five application tables', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name)

    expect(tables).toEqual(
      expect.arrayContaining([
        'who_votes',
        'gallery_photos',
        'guestbook_entries',
        'memories_entries',
        'app_config',
      ])
    )
    db.close()
  })

  it('enforces one vote per question per voter', () => {
    const db = createDb(':memory:')
    const insert = db.prepare(
      'INSERT INTO who_votes (question_id, voter_id, option) VALUES (?, ?, ?)'
    )
    insert.run('q1', 'voter-1', 'Saruga')

    expect(() => insert.run('q1', 'voter-1', 'Vinith')).toThrowError(
      /UNIQUE constraint failed/
    )

    try {
      insert.run('q1', 'voter-1', 'Vinith')
    } catch (error) {
      expect((error as { code: string }).code).toBe(
        'SQLITE_CONSTRAINT_UNIQUE'
      )
    }
    db.close()
  })

  it('creates the parent directory if it does not exist yet', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'wedding-db-test-'))
    const nestedPath = path.join(tempRoot, 'data', 'wedding.db')
    expect(existsSync(path.dirname(nestedPath))).toBe(false)

    const db = createDb(nestedPath)
    expect(existsSync(nestedPath)).toBe(true)
    db.close()

    rmSync(tempRoot, { recursive: true, force: true })
  })

  it('creates gallery_photos with category and is_official columns, with correct defaults', () => {
    const db = createDb(':memory:')
    db.prepare(
      `INSERT INTO gallery_photos (id, thumb_key, original_key, uploader_name, delete_token_hash)
       VALUES (?, ?, ?, ?, ?)`
    ).run('p1', 't1', 'o1', 'Anna', 'hash1')

    const row = db
      .prepare('SELECT category, is_official FROM gallery_photos WHERE id = ?')
      .get('p1') as { category: string; is_official: number }

    expect(row.category).toBe('Hochzeit')
    expect(row.is_official).toBe(0)
    db.close()
  })

  it('applying the schema twice on the same connection does not throw (idempotent migration)', () => {
    const db = createDb(':memory:')
    expect(() => applySchema(db)).not.toThrow()
    db.close()
  })

  it('migrates an existing gallery_photos table (created before this change) by adding the new columns with working defaults', () => {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE gallery_photos (
        id TEXT PRIMARY KEY,
        thumb_key TEXT NOT NULL,
        original_key TEXT NOT NULL,
        uploader_name TEXT NOT NULL,
        delete_token_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    `)
    db.prepare(
      `INSERT INTO gallery_photos (id, thumb_key, original_key, uploader_name, delete_token_hash)
       VALUES (?, ?, ?, ?, ?)`
    ).run('old-photo', 't', 'o', 'Anna', 'hash')

    applySchema(db)

    const row = db
      .prepare('SELECT category, is_official FROM gallery_photos WHERE id = ?')
      .get('old-photo') as { category: string; is_official: number }
    expect(row.category).toBe('Hochzeit')
    expect(row.is_official).toBe(0)
    db.close()
  })
})

describe('getDb', () => {
  const originalPath = process.env.DATABASE_PATH

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
  })

  it('returns the same connection on repeated calls', () => {
    expect(getDb()).toBe(getDb())
  })
})
