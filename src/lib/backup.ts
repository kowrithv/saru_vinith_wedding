import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

export const HOURLY_KEEP = 48
export const DAILY_KEEP = 30

const BACKUP_FILE_PATTERN = /^wedding-\d{8}-\d{6}\.db$/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

// UTC, damit die Namen lexikographisch = chronologisch sortieren und die
// Rotation nicht von der Zeitzone des Servers abhängt.
export function backupFileName(now: Date): string {
  const date = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  return `wedding-${date}-${time}.db`
}

/**
 * Aufbewahrung: die neuesten HOURLY_KEEP Sicherungen plus je die erste
 * Sicherung eines Tages für die neuesten DAILY_KEEP Tage. Dateien, die
 * keine Sicherungen sind, werden nie ausgewählt.
 */
export function selectBackupsToDelete(fileNames: string[]): string[] {
  const backups = fileNames.filter((name) => BACKUP_FILE_PATTERN.test(name)).sort()
  const keep = new Set(backups.slice(-HOURLY_KEEP))

  const firstOfDay = new Map<string, string>()
  for (const name of backups) {
    const day = name.slice(8, 16)
    if (!firstOfDay.has(day)) firstOfDay.set(day, name)
  }
  const newestDays = [...firstOfDay.keys()].sort().slice(-DAILY_KEEP)
  for (const day of newestDays) keep.add(firstOfDay.get(day) as string)

  return backups.filter((name) => !keep.has(name))
}

function removeWithSidecars(filePath: string): void {
  rmSync(filePath, { force: true })
  rmSync(`${filePath}-wal`, { force: true })
  rmSync(`${filePath}-shm`, { force: true })
}

function verifyBackup(filePath: string): void {
  const copy = new Database(filePath, { readonly: true, fileMustExist: true })
  try {
    const rows = copy.pragma('integrity_check') as { integrity_check: string }[]
    if (rows.length !== 1 || rows[0].integrity_check !== 'ok') {
      throw new Error(`Integritätsprüfung fehlgeschlagen: ${JSON.stringify(rows).slice(0, 200)}`)
    }
  } finally {
    copy.close()
  }
  // Das schreibgeschützte Öffnen einer WAL-Datenbank kann Begleitdateien
  // anlegen, die nach dem Schließen nicht zur Sicherung gehören.
  rmSync(`${filePath}-wal`, { force: true })
  rmSync(`${filePath}-shm`, { force: true })
}

export interface BackupResult {
  fileName: string
  filePath: string
  sizeBytes: number
}

export async function createBackup(
  db: Database.Database,
  dir: string,
  now: Date = new Date()
): Promise<BackupResult> {
  mkdirSync(dir, { recursive: true })
  const fileName = backupFileName(now)
  const filePath = path.join(dir, fileName)
  try {
    await db.backup(filePath)
    verifyBackup(filePath)
  } catch (error) {
    // Eine defekte Kopie darf nicht in der Rotation bleiben.
    removeWithSidecars(filePath)
    throw error
  }
  return { fileName, filePath, sizeBytes: statSync(filePath).size }
}

export function pruneBackups(dir: string): string[] {
  const doomed = selectBackupsToDelete(readdirSync(dir))
  for (const name of doomed) {
    rmSync(path.join(dir, name), { force: true })
  }
  return doomed
}
