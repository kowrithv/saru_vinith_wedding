import { describe, expect, it } from 'vitest'
import { polaroidCaption, receptionEvent, receptionSchedule } from './event-info'

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

describe('polaroidCaption', () => {
  it('names the occasion and writes the date like the example of the polaroid', () => {
    expect(polaroidCaption).toEqual({ occasion: 'Standesamtliche Hochzeit', date: '17.10.2026' })
  })
})

describe('receptionSchedule', () => {
  it('gives every point of the day an icon for the timeline', () => {
    receptionSchedule.forEach((item) => expect(item.icon, item.event).toBeDefined())
  })
})
