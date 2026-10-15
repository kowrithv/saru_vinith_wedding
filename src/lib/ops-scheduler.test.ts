import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BACKUP_INTERVAL_MS,
  defaultBackupDir,
  DISK_ALERT_THRESHOLD,
  DISK_CHECK_INTERVAL_MS,
  diskUsageFraction,
  WAL_CHECKPOINT_INTERVAL_MS,
  startOpsScheduler,
} from './ops-scheduler'

describe('diskUsageFraction', () => {
  it('computes used blocks relative to all blocks of the file system', () => {
    const statfs = vi.fn(() => ({ blocks: 1000, bavail: 150 })) as never
    expect(diskUsageFraction('/data', statfs)).toBeCloseTo(0.85)
  })
})

describe('defaultBackupDir', () => {
  it('puts the backups next to the database file, keeping a relative path relative', () => {
    expect(defaultBackupDir('data/wedding.db')).toBe(path.join('data', 'backups'))
    expect(defaultBackupDir('/var/app/data/wedding.db')).toBe(path.join('/var/app/data', 'backups'))
  })

  it('does not resolve against the working directory (that makes the Next.js tracer pull the whole project into the standalone build)', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/lib/ops-scheduler.ts'), 'utf8')
    expect(source).not.toMatch(/path\.resolve\(|process\.cwd\(/)
  })
})

describe('startOpsScheduler', () => {
  const fakeDb = {} as never
  let deps: {
    getDb: ReturnType<typeof vi.fn>
    createBackup: ReturnType<typeof vi.fn>
    pruneBackups: ReturnType<typeof vi.fn>
    sendAlert: ReturnType<typeof vi.fn>
    diskUsage: ReturnType<typeof vi.fn>
    checkpoint: ReturnType<typeof vi.fn>
  }
  let running: { stop: () => void } | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    deps = {
      getDb: vi.fn(() => fakeDb),
      createBackup: vi.fn().mockResolvedValue({ fileName: 'wedding-x.db', filePath: '/b/wedding-x.db', sizeBytes: 10 }),
      pruneBackups: vi.fn().mockReturnValue([]),
      sendAlert: vi.fn().mockResolvedValue('sent'),
      diskUsage: vi.fn().mockReturnValue(0.4),
      checkpoint: vi.fn().mockReturnValue({ busy: 0, log: 0, checkpointed: 0 }),
    }
  })

  afterEach(() => {
    running?.stop()
    running = undefined
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const start = () => {
    running = startOpsScheduler({ ...deps, backupDir: '/data/backups' } as never)
    return running
  }

  it('sends a start notice and makes a first backup right away', async () => {
    start()
    await vi.advanceTimersByTimeAsync(0)

    expect(deps.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'app-started', cooldownMs: 15 * 60 * 1000 })
    )
    expect(deps.createBackup).toHaveBeenCalledTimes(1)
    expect(deps.createBackup).toHaveBeenCalledWith(fakeDb, '/data/backups', expect.any(Date))
    expect(deps.pruneBackups).toHaveBeenCalledWith('/data/backups')
  })

  it('repeats the backup every hour', async () => {
    start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS)

    expect(deps.createBackup).toHaveBeenCalledTimes(3)
  })

  it('alerts when a backup fails and keeps running', async () => {
    deps.createBackup.mockRejectedValueOnce(new Error('disk I/O error'))
    start()
    await vi.advanceTimersByTimeAsync(0)

    expect(deps.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'backup-failed', body: expect.stringContaining('disk I/O error') })
    )

    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS)
    expect(deps.createBackup).toHaveBeenCalledTimes(2)
  })

  it('does not start a second backup while the previous one is still running, and says so', async () => {
    let finish!: (value: { fileName: string; filePath: string; sizeBytes: number }) => void
    deps.createBackup.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS)

    expect(deps.createBackup).toHaveBeenCalledTimes(1)
    expect(deps.sendAlert).toHaveBeenCalledWith(expect.objectContaining({ key: 'backup-stuck' }))

    finish({ fileName: 'wedding-x.db', filePath: '/b/wedding-x.db', sizeBytes: 10 })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS)
    expect(deps.createBackup).toHaveBeenCalledTimes(2)
  })

  it('does not prune after a failed backup', async () => {
    deps.createBackup.mockRejectedValueOnce(new Error('boom'))
    start()
    await vi.advanceTimersByTimeAsync(0)
    expect(deps.pruneBackups).not.toHaveBeenCalled()
  })

  it('alerts when the disk is at or above the threshold', async () => {
    deps.diskUsage.mockReturnValue(DISK_ALERT_THRESHOLD)
    start()
    await vi.advanceTimersByTimeAsync(0)

    expect(deps.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'disk-full', body: expect.stringContaining('85') })
    )
  })

  it('stays quiet below the threshold and checks again every ten minutes', async () => {
    start()
    await vi.advanceTimersByTimeAsync(0)
    expect(deps.sendAlert).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'disk-full' }))

    await vi.advanceTimersByTimeAsync(DISK_CHECK_INTERVAL_MS)
    expect(deps.diskUsage).toHaveBeenCalledTimes(2)
  })

  it('does not break when the disk check itself throws', async () => {
    deps.diskUsage.mockImplementation(() => {
      throw new Error('statfs unavailable')
    })
    start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(DISK_CHECK_INTERVAL_MS)

    expect(deps.createBackup).toHaveBeenCalled()
  })

  it('does not keep the process alive for its timers', () => {
    const unref = vi.fn()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation((() => ({ unref })) as never)
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval').mockImplementation((() => {}) as never)
    try {
      start()
      // Sicherung, Platten-Prüfung und WAL-Checkpoint
      expect(setIntervalSpy).toHaveBeenCalledTimes(3)
      expect(unref).toHaveBeenCalledTimes(3)
      running?.stop()
      running = undefined
    } finally {
      // Vor useRealTimers zurücksetzen: sonst bliebe die Fake-Funktion global stehen.
      setIntervalSpy.mockRestore()
      clearIntervalSpy.mockRestore()
    }
  })

  // Bei Dauer-Lesern kommt SQLite nie zum Zurücksetzen des Logs: ein fester Takt
  // räumt es auf.
  it('empties the write-ahead log every ten minutes', async () => {
    start()
    await vi.advanceTimersByTimeAsync(0)
    expect(deps.checkpoint).toHaveBeenCalledTimes(1)
    expect(deps.checkpoint).toHaveBeenCalledWith(fakeDb)

    await vi.advanceTimersByTimeAsync(WAL_CHECKPOINT_INTERVAL_MS)
    expect(deps.checkpoint).toHaveBeenCalledTimes(2)
    expect(WAL_CHECKPOINT_INTERVAL_MS).toBe(10 * 60 * 1000)
  })

  it('keeps running when a checkpoint fails', async () => {
    deps.checkpoint.mockImplementation(() => {
      throw new Error('database is locked')
    })
    start()
    await vi.advanceTimersByTimeAsync(WAL_CHECKPOINT_INTERVAL_MS * 2)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('database is locked'))
    expect(deps.checkpoint.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('starts only once per process and stop() clears all timers', async () => {
    const first = start()
    const second = startOpsScheduler({ ...deps, backupDir: '/data/backups' } as never)
    expect(second).toBe(first)

    first.stop()
    running = undefined
    expect(vi.getTimerCount()).toBe(0)
  })
})
