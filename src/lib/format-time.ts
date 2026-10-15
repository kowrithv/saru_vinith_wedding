/** Sekunden als mm:ss (Minuten zählen über eine Stunde hinaus weiter). */
export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const MOMENT_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Berlin',
})

/** "12.10. um 21:14 Uhr" in deutscher Zeit, oder '' bei einem unbrauchbaren Datum. */
export function formatPhotoMoment(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(MOMENT_FORMAT.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.day}.${parts.month}. um ${parts.hour}:${parts.minute} Uhr`
}

const ENTRY_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Berlin',
})

/** "12. Okt. 2026 · 21:14 Uhr" in deutscher Zeit, oder '' bei einem unbrauchbaren Datum. */
export function formatEntryMoment(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(ENTRY_FORMAT.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.day}. ${parts.month} ${parts.year} · ${parts.hour}:${parts.minute} Uhr`
}
