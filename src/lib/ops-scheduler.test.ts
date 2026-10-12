import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BACKUP_INTERVAL_MS,
  DISK_ALERT_THRESHOLD,
  DISK_CHECK_INTERVAL_MS,
  diskUsageFraction,
  startOpsScheduler,
} from './ops-scheduler'

describe('diskUsageFraction', () => {
  it('computes used blocks relative to all blocks of the file system', () => {
    const statfs = vi.fn(() => ({ blocks: 1000, bavail: 150 })) as never
    expect(diskUsageFraction('/data', statfs)).toBeCloseTo(0.85)
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

  it('starts only once per process and stop() clears all timers', async () => {
    const first = start()
    const second = startOpsScheduler({ ...deps, backupDir: '/data/backups' } as never)
    expect(second).toBe(first)

    first.stop()
    running = undefined
    expect(vi.getTimerCount()).toBe(0)
  })
})
