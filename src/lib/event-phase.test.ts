import { describe, expect, it } from 'vitest'
import { eventPhase, nextProgramIndex } from './event-phase'

// Alle Zeitpunkte absolut: deutscher Sommerzeit-Offset +02:00 (MESZ).
const at = (iso: string) => Date.parse(iso)

describe('eventPhase', () => {
  it('is "before" until midnight of the wedding day', () => {
    expect(eventPhase(at('2026-10-15T12:00:00+02:00'))).toBe('before')
    expect(eventPhase(at('2026-10-16T23:59:59+02:00'))).toBe('before')
  })

  it('is "today" for the whole wedding day, in German time', () => {
    expect(eventPhase(at('2026-10-17T00:00:00+02:00'))).toBe('today')
    expect(eventPhase(at('2026-10-17T16:30:00+02:00'))).toBe('today')
    expect(eventPhase(at('2026-10-17T23:59:59+02:00'))).toBe('today')
  })

  it('is "after" from the next German midnight', () => {
    expect(eventPhase(at('2026-10-18T00:00:00+02:00'))).toBe('after')
    expect(eventPhase(at('2026-11-01T12:00:00+01:00'))).toBe('after')
  })

  it('does not depend on the time zone of the device: 22:30 UTC on the 16th is already the 17th in Germany', () => {
    expect(eventPhase(at('2026-10-16T22:30:00Z'))).toBe('today')
    expect(eventPhase(at('2026-10-16T21:59:59Z'))).toBe('before')
  })
})

describe('nextProgramIndex', () => {
  const schedule = [
    { time: '16:30 Uhr', event: 'Einlass' },
    { time: 'TBA', event: 'Sektempfang' },
    { time: '19:00 Uhr', event: 'Abendessen' },
  ]

  it('marks nothing before the wedding day', () => {
    expect(nextProgramIndex(at('2026-10-16T12:00:00+02:00'), schedule)).toBeNull()
  })

  it('marks the first item that has not started yet, skipping items without a time', () => {
    expect(nextProgramIndex(at('2026-10-17T10:00:00+02:00'), schedule)).toBe(0)
    expect(nextProgramIndex(at('2026-10-17T16:30:00+02:00'), schedule)).toBe(2)
    expect(nextProgramIndex(at('2026-10-17T18:59:59+02:00'), schedule)).toBe(2)
  })

  it('marks nothing once every timed item is over', () => {
    expect(nextProgramIndex(at('2026-10-17T19:00:00+02:00'), schedule)).toBeNull()
    expect(nextProgramIndex(at('2026-10-18T09:00:00+02:00'), schedule)).toBeNull()
  })

  it('marks nothing while no item has a usable time', () => {
    const open = [{ time: 'TBA', event: 'A' }, { time: 'TBA', event: 'B' }]
    expect(nextProgramIndex(at('2026-10-17T10:00:00+02:00'), open)).toBeNull()
  })
})
