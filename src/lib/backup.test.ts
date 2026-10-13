import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applySchema } from './db'
import {
  backupFileName,
  createBackup,
  DAILY_KEEP,
  HOURLY_KEEP,
  pruneBackups,
  selectBackupsToDelete,
} from './backup'

function nameFor(isoUtc: string): string {
  return backupFileName(new Date(isoUtc))
}

describe('backupFileName', () => {
  it('uses the UTC timestamp so names sort chronologically', () => {
    expect(backupFileName(new Date('2026-10-17T14:30:05Z'))).toBe('wedding-20261017-143005.db')
  })
})

describe('selectBackupsToDelete', () => {
  it('keeps everything while there are fewer files than the hourly window', () => {
    const names = [nameFor('2026-10-17T10:00:00Z'), nameFor('2026-10-17T11:00:00Z')]
    expect(selectBackupsToDelete(names)).toEqual([])
  })

  it('keeps the newest 48 plus the first backup of each of the last 30 days, and deletes the rest', () => {
    // 10 Tage stündlich = 240 Dateien
    const names: string[] = []
    for (let day = 1; day <= 10; day++) {
      for (let hour = 0; hour < 24; hour++) {
        names.push(nameFor(`2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`))
      }
    }

    const deleted = selectBackupsToDelete(names)
    const kept = names.filter((name) => !deleted.includes(name))

    // 48 neueste (letzte zwei Tage) + je erste des Tages für die übrigen 8 Tage
    expect(kept).toHaveLength(HOURLY_KEEP + 8)
    expect(kept).toContain(nameFor('2026-10-10T23:00:00Z'))
    expect(kept).toContain(nameFor('2026-10-03T00:00:00Z'))
    expect(kept).not.toContain(nameFor('2026-10-03T05:00:00Z'))
  })

  it('keeps at most one daily backup for each of the newest 30 days', () => {
    const names: string[] = []
    for (let day = 1; day <= 31; day++) {
      names.push(nameFor(`2026-08-${String(day).padStart(2, '0')}T06:00:00Z`))
    }
    for (let day = 1; day <= 30; day++) {
      names.push(nameFor(`2026-09-${String(day).padStart(2, '0')}T06:00:00Z`))
    }
    const deleted = selectBackupsToDelete(names)
    const kept = names.filter((name) => !deleted.includes(name))

    expect(kept.length).toBeLessThanOrEqual(HOURLY_KEEP + DAILY_KEEP)
    expect(kept).toContain(nameFor('2026-09-30T06:00:00Z'))
    expect(kept).not.toContain(nameFor('2026-08-01T06:00:00Z'))
  })

  it('keeps one backup per hour, so several starts within an hour do not push older history out', () => {
    const names: string[] = []
    // 48 normale stündliche Sicherungen ...
    for (let hour = 0; hour < 48; hour++) {
      const day = 10 + Math.floor(hour / 24)
      names.push(nameFor(`2026-10-${day}T${String(hour % 24).padStart(2, '0')}:00:00Z`))
    }
    // ... danach eine Neustart-Schleife: eine Sicherung pro Minute für 50 Minuten.
    for (let minute = 0; minute < 50; minute++) {
      names.push(nameFor(`2026-10-12T00:${String(minute).padStart(2, '0')}:30Z`))
    }

    const deleted = selectBackupsToDelete(names)
    const kept = names.filter((name) => !deleted.includes(name))

    // Die Historie der letzten zwei Tage bleibt vollständig erhalten.
    for (let hour = 1; hour < 48; hour++) {
      const day = 10 + Math.floor(hour / 24)
      expect(kept).toContain(nameFor(`2026-10-${day}T${String(hour % 24).padStart(2, '0')}:00:00Z`))
    }
    // Aus der Schleife bleibt nur die erste ihrer Stunde plus die allerneueste.
    const loopKept = kept.filter((name) => name.startsWith('wedding-20261012-00'))
    expect(loopKept).toEqual([nameFor('2026-10-12T00:00:30Z'), nameFor('2026-10-12T00:49:30Z')])
  })

  it('always keeps the newest backup, even when it is not the first of its hour', () => {
    const names = [nameFor('2026-10-17T10:00:00Z'), nameFor('2026-10-17T10:20:00Z'), nameFor('2026-10-17T10:50:00Z')]
    const deleted = selectBackupsToDelete(names)

    expect(deleted).toEqual([nameFor('2026-10-17T10:20:00Z')])
  })

  it('never selects files that are not backups', () => {
    const names = ['notes.txt', 'wedding.db', 'wedding-20261017-143005.db-wal', nameFor('2026-10-17T10:00:00Z')]
    expect(selectBackupsToDelete(names)).toEqual([])
  })
})

describe('createBackup / pruneBackups', () => {
  let dir: string
  let source: Database.Database

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'backup-test-'))
    source = new Database(path.join(dir, 'source.db'))
    applySchema(source)
  })

  afterEach(() => {
    source.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('writes a readable copy that contains the current data', async () => {
    source.prepare("INSERT INTO app_config (key, value) VALUES ('hello', 'world')").run()
    const backupDir = path.join(dir, 'backups')

    const result = await createBackup(source, backupDir, new Date('2026-10-17T14:30:05Z'))

    expect(result.fileName).toBe('wedding-20261017-143005.db')
    expect(result.sizeBytes).toBeGreaterThan(0)
    const copy = new Database(result.filePath, { readonly: true })
    const row = copy.prepare("SELECT value FROM app_config WHERE key = 'hello'").get() as { value: string }
    copy.close()
    expect(row.value).toBe('world')
  })

  it('leaves only the backup file in the folder (no WAL/SHM leftovers from the integrity check)', async () => {
    const backupDir = path.join(dir, 'backups')
    await createBackup(source, backupDir, new Date('2026-10-17T14:30:05Z'))
    expect(readdirSync(backupDir)).toEqual(['wedding-20261017-143005.db'])
  })

  it('rejects and removes the file when the copy fails the integrity check', async () => {
    const backupDir = path.join(dir, 'backups')
    const brokenDb = {
      backup: async (target: string) => {
        writeFileSync(target, 'this is not a database')
      },
    } as unknown as Database.Database

    await expect(createBackup(brokenDb, backupDir, new Date('2026-10-17T14:30:05Z'))).rejects.toThrow()
    expect(readdirSync(backupDir)).toEqual([])
  })

  it('prunes the folder according to the retention rules and reports what it deleted', () => {
    const backupDir = path.join(dir, 'backups')
    mkdirSync(backupDir)
    for (let hour = 0; hour < 24; hour++) {
      for (let day = 1; day <= 4; day++) {
        const stamp = `2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`
        writeFileSync(path.join(backupDir, nameFor(stamp)), 'x')
      }
    }
    writeFileSync(path.join(backupDir, 'README.txt'), 'keep me')

    const deleted = pruneBackups(backupDir)

    expect(deleted.length).toBeGreaterThan(0)
    expect(readdirSync(backupDir)).toContain('README.txt')
    expect(readdirSync(backupDir).filter((n) => n.endsWith('.db'))).toHaveLength(HOURLY_KEEP + 2)
  })
})
