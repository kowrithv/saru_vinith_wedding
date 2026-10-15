import type { ScheduleItem } from './event-info'

// Die Seite kennt drei Zustände: vor dem Hochzeitstag, am Hochzeitstag und
// danach. Die Grenzen sind feste Zeitpunkte mit Offset (MESZ, UTC+2), nicht
// "heute" des Geräts: Gäste im Ausland sehen sonst den falschen Tag.
export type EventPhase = 'before' | 'today' | 'after'

const DAY_START_MS = Date.parse('2026-10-17T00:00:00+02:00')
const DAY_END_MS = Date.parse('2026-10-18T00:00:00+02:00')

export function eventPhase(nowMs: number): EventPhase {
  if (nowMs < DAY_START_MS) return 'before'
  if (nowMs < DAY_END_MS) return 'today'
  return 'after'
}

// Auch ungefähre Angaben: "ca. 18:30 Uhr", "~ 18:30 Uhr"; bei einem Bereich
// ("ca. 20:00 – 21:00 Uhr") zählt der Beginn.
const TIME_PATTERN = /^(?:ca\.?\s*|~\s*)?(\d{1,2}):(\d{2})/i

/** Beginn eines Programmpunkts am Hochzeitstag in ms, oder null ("TBA", Freitext). */
function itemStartMs(time: string): number | null {
  const match = TIME_PATTERN.exec(time.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return DAY_START_MS + (hours * 60 + minutes) * 60 * 1000
}

/**
 * Index des nächsten Programmpunkts mit bekannter Uhrzeit, der noch nicht
 * begonnen hat. Nur am Hochzeitstag; davor und danach gibt es kein "Als
 * Nächstes". Punkte ohne Uhrzeit werden übersprungen.
 */
export function nextProgramIndex(nowMs: number, schedule: ScheduleItem[]): number | null {
  if (eventPhase(nowMs) !== 'today') return null
  for (let i = 0; i < schedule.length; i++) {
    const start = itemStartMs(schedule[i].time)
    if (start !== null && start > nowMs) return i
  }
  return null
}
