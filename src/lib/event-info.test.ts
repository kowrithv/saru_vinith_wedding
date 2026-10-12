import { describe, expect, it } from 'vitest'
import { receptionEvent } from './event-info'

describe('receptionEvent', () => {
  it('starts at 16:30 German summer time as one absolute instant', () => {
    // 16:30 MESZ (UTC+2) = 14:30 UTC. Eine Angabe ohne Offset würde in der
    // Zeitzone des jeweiligen Geräts gelesen - Gäste im Ausland sähen den
    // Countdown zur falschen Zeit ablaufen.
    expect(Date.parse(receptionEvent.startsAt)).toBe(Date.UTC(2026, 9, 17, 14, 30))
  })

  it('shows the same start time as the display strings', () => {
    expect(receptionEvent.time).toBe('16:30 Uhr')
    expect(receptionEvent.displayDate).toBe('17. Oktober 2026')
  })
})
