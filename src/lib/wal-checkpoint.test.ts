// @vitest-environment node
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from './db'
import { checkpointWal } from './wal-checkpoint'

describe('WAL checkpoint', () => {
  let dir: string
  let db: Database.Database

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'wal-'))
    db = createDb(path.join(dir, 'wedding.db'))
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('checkpoints more often than the SQLite default of 1000 pages', () => {
    expect(db.pragma('wal_autocheckpoint', { simple: true })).toBe(512)
  })

  it('empties the write-ahead log, which otherwise only grows while readers keep coming', () => {
    const insert = db.prepare('INSERT INTO guestbook_entries (name, message) VALUES (?, ?)')
    for (let i = 0; i < 400; i++) insert.run(`Gast ${i}`, 'x'.repeat(200))
    const walFile = path.join(dir, 'wedding.db-wal')
    expect(existsSync(walFile) && statSync(walFile).size).toBeGreaterThan(0)

    const result = checkpointWal(db)

    expect(result.busy).toBe(0)
    expect(statSync(walFile).size).toBe(0)
  })

  it('keeps the data readable afterwards', () => {
    db.prepare('INSERT INTO guestbook_entries (name, message) VALUES (?, ?)').run('Anna', 'Hallo zusammen!')
    checkpointWal(db)
    const row = db.prepare('SELECT name FROM guestbook_entries').get() as { name: string }
    expect(row.name).toBe('Anna')
  })
})
