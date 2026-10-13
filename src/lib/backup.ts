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
 * Aufbewahrung: die allerneueste Sicherung, dazu je die erste Sicherung einer
 * Stunde für die neuesten HOURLY_KEEP Stunden und je die erste eines Tages für
 * die neuesten DAILY_KEEP Tage. Mehrere Sicherungen innerhalb einer Stunde
 * (z. B. Neustart-Schleife) verdrängen so keine ältere Historie. Dateien, die
 * keine Sicherungen sind, werden nie ausgewählt.
 */
export function selectBackupsToDelete(fileNames: string[]): string[] {
  const backups = fileNames.filter((name) => BACKUP_FILE_PATTERN.test(name)).sort()
  const keep = new Set<string>()
  if (backups.length > 0) keep.add(backups[backups.length - 1])

  const firstOfHour = new Map<string, string>()
  const firstOfDay = new Map<string, string>()
  for (const name of backups) {
    const hour = name.slice(8, 19) // YYYYMMDD-HH
    const day = name.slice(8, 16) // YYYYMMDD
    if (!firstOfHour.has(hour)) firstOfHour.set(hour, name)
    if (!firstOfDay.has(day)) firstOfDay.set(day, name)
  }
  for (const hour of [...firstOfHour.keys()].sort().slice(-HOURLY_KEEP)) {
    keep.add(firstOfHour.get(hour) as string)
  }
  for (const day of [...firstOfDay.keys()].sort().slice(-DAILY_KEEP)) {
    keep.add(firstOfDay.get(day) as string)
  }

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
