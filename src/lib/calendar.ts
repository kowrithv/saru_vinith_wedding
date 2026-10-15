import { receptionEvent } from './event-info'
import { couple } from './site-content'

// Termin für den Kalender (iCalendar, RFC 5545). Die Datei wird im Browser
// erzeugt: kein Server, kein Konto. Der Beginn steht in UTC, damit jedes Gerät
// dieselbe Uhrzeit anzeigt. Ein Ende kennen wir nicht; es wird nicht erfunden.

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Zeilen über 75 Zeichen werden mit CRLF + Leerzeichen umgebrochen. */
export function foldIcsLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  return parts.join('\r\n')
}

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function buildEventIcs(now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Saruga und Vinith//Hochzeit 2026//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:hochzeit-2026-10-17@vsjourney.de',
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(new Date(receptionEvent.startsAt))}`,
    `SUMMARY:${escapeIcsText(`Hochzeit ${couple.combinedName}`)}`,
    `LOCATION:${escapeIcsText(`${receptionEvent.venue}, ${receptionEvent.address}`)}`,
    `GEO:${receptionEvent.lat};${receptionEvent.lng}`,
    `DESCRIPTION:${escapeIcsText(`${receptionEvent.description}\n\nAlle Infos: https://vsjourney.de/info`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}

/** Löst den Download der Kalenderdatei aus (Blob, gleicher Ursprung). */
export function downloadEventIcs(): void {
  const blob = new Blob([buildEventIcs()], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'hochzeit-saruga-vinith.ics'
  link.click()
  URL.revokeObjectURL(url)
}
