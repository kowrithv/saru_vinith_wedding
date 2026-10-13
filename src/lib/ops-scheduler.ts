import { statfsSync } from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { getDb } from '@/lib/db'
import { createBackup, pruneBackups } from '@/lib/backup'
import { sendAlert } from '@/lib/alerts'

export const BACKUP_INTERVAL_MS = 60 * 60 * 1000
export const DISK_CHECK_INTERVAL_MS = 10 * 60 * 1000
export const DISK_ALERT_THRESHOLD = 0.85
const START_NOTICE_COOLDOWN_MS = 15 * 60 * 1000

export function diskUsageFraction(dir: string, statfs: typeof statfsSync = statfsSync): number {
  const stats = statfs(dir)
  if (!stats.blocks) return 0
  return (stats.blocks - stats.bavail) / stats.blocks
}

export interface SchedulerDeps {
  getDb?: () => Database.Database
  backupDir?: string
  createBackup?: typeof createBackup
  pruneBackups?: typeof pruneBackups
  sendAlert?: typeof sendAlert
  diskUsage?: (dir: string) => number
  now?: () => Date
}

export interface RunningScheduler {
  stop: () => void
}

declare global {
  var __opsScheduler: RunningScheduler | undefined
}

// Bewusst nicht gegen das Arbeitsverzeichnis aufgelöst: ein so gebildeter,
// dynamischer Pfad lässt den Next.js-Tracer das ganze Projekt
// (inkl. data/ und docs/) in den Standalone-Build kopieren. Ein relativer Pfad
// bleibt relativ und wird vom Prozess ohnehin gegen das Arbeitsverzeichnis
// geöffnet - genau wie die Datenbank selbst.
export function defaultBackupDir(dbPath: string = process.env.DATABASE_PATH ?? 'data/wedding.db'): string {
  return path.join(path.dirname(dbPath), 'backups')
}

/**
 * Startet Backup- und Platten-Prüfung einmalig pro Prozess. Alle Timer sind
 * unref()ed; Fehler werden gemeldet (Log/E-Mail), brechen den Scheduler aber
 * nie ab.
 */
export function startOpsScheduler(deps: SchedulerDeps = {}): RunningScheduler {
  if (globalThis.__opsScheduler) return globalThis.__opsScheduler

  const resolveDb = deps.getDb ?? getDb
  const backupDir = deps.backupDir ?? defaultBackupDir()
  const doBackup = deps.createBackup ?? createBackup
  const doPrune = deps.pruneBackups ?? pruneBackups
  const alert = deps.sendAlert ?? sendAlert
  const diskUsage = deps.diskUsage ?? diskUsageFraction
  const now = deps.now ?? (() => new Date())

  // Zwei Sicherungen gleichzeitig würden sich gegenseitig die Arbeitsdateien
  // wegräumen; ein Lauf, der nach einer Stunde noch läuft, ist außerdem selbst
  // ein Alarmgrund (Platte voll/blockiert, Datenbank dauerhaft gesperrt).
  let backupRunning = false

  const runBackup = async () => {
    if (backupRunning) {
      await alert({
        key: 'backup-stuck',
        subject: 'Datenbank-Sicherung hängt',
        body: `Die vorige Sicherung nach ${backupDir} läuft nach über einer Stunde noch. Die neue wurde nicht gestartet.`,
      })
      return
    }
    backupRunning = true
    let failure: string | undefined
    try {
      const result = await doBackup(resolveDb(), backupDir, now())
      const removed = doPrune(backupDir)
      console.warn(`[backup] ok: ${result.fileName} (${result.sizeBytes} Bytes), ${removed.length} alte entfernt`)
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    } finally {
      backupRunning = false
    }
    if (failure !== undefined) {
      await alert({
        key: 'backup-failed',
        subject: 'Datenbank-Sicherung fehlgeschlagen',
        body: `Die stündliche Sicherung nach ${backupDir} ist fehlgeschlagen: ${failure}`,
      })
    }
  }

  const runDiskCheck = () => {
    try {
      const used = diskUsage(path.dirname(backupDir))
      if (used >= DISK_ALERT_THRESHOLD) {
        void alert({
          key: 'disk-full',
          subject: 'Speicherplatz wird knapp',
          body: `Die Platte mit den Daten ist zu ${Math.round(used * 100)} % belegt (Schwelle ${Math.round(DISK_ALERT_THRESHOLD * 100)} %).`,
        })
      }
    } catch (error) {
      console.error(`[ops] Platten-Prüfung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  void alert({
    key: 'app-started',
    subject: 'App gestartet',
    body: `Die Hochzeitsseite wurde um ${now().toISOString()} gestartet.`,
    cooldownMs: START_NOTICE_COOLDOWN_MS,
  })
  void runBackup()
  runDiskCheck()

  const backupTimer = setInterval(() => void runBackup(), BACKUP_INTERVAL_MS)
  const diskTimer = setInterval(runDiskCheck, DISK_CHECK_INTERVAL_MS)
  backupTimer.unref?.()
  diskTimer.unref?.()

  const running: RunningScheduler = {
    stop: () => {
      clearInterval(backupTimer)
      clearInterval(diskTimer)
      globalThis.__opsScheduler = undefined
    },
  }
  globalThis.__opsScheduler = running
  return running
}
