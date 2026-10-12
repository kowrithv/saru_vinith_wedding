import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createDb, getDb } from './db'

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
