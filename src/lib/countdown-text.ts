interface Remaining {
  days: number
  hours: number
  minutes: number
}

const unit = (value: number, singular: string, plural: string) => `${value} ${value === 1 ? singular : plural}`

/**
 * Die Restzeit als ruhiger Satz ("Noch 2 Tage, 6 Stunden und 30 Minuten"):
 * Tage nur, solange es welche gibt, Stunden danach immer, Minuten zuletzt.
 */
export function quietCountdownSentence({ days, hours, minutes }: Remaining): string {
  const parts: string[] = []
  if (days > 0) parts.push(unit(days, 'Tag', 'Tage'))
  if (days > 0 || hours > 0) parts.push(unit(hours, 'Stunde', 'Stunden'))
  if (days > 0 || hours > 0 || minutes > 0) parts.push(unit(minutes, 'Minute', 'Minuten'))
  if (parts.length === 0) return 'Gleich geht es los'
  if (parts.length === 1) return `Noch ${parts[0]}`
  return `Noch ${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}`
}
