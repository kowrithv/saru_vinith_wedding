import { describe, expect, it, vi } from 'vitest'
import { calculateTimeUntil, cn } from './utils'

describe('cn', () => {
  it('joins multiple class strings', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('resolves conflicting Tailwind utilities, keeping the last one', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
  })

  it('applies conditional classes based on a boolean', () => {
    const isActive = true
    expect(cn('base', isActive && 'active')).toBe('base active')
  })
})

describe('calculateTimeUntil', () => {
  // Alle Zeiten sind absolute Zeitpunkte (Offset bzw. Z): das Ergebnis darf
  // nicht von der Zeitzone des Geräts oder des CI-Runners abhängen.
  const target = '2026-10-17T16:30:00+02:00'

  it('computes days/hours/minutes/seconds until a future instant', () => {
    const now = Date.parse('2026-10-15T10:00:00+02:00')

    const result = calculateTimeUntil(target, now)

    expect(result.isPast).toBe(false)
    expect(result.days).toBe(2)
    expect(result.hours).toBe(6)
    expect(result.minutes).toBe(30)
    expect(result.seconds).toBe(0)
  })

  it('gives the same result for the same instant written in another UTC offset', () => {
    const now = Date.parse('2026-10-15T08:00:00Z')

    expect(calculateTimeUntil(target, now)).toEqual(
      calculateTimeUntil('2026-10-17T14:30:00Z', Date.parse('2026-10-15T10:00:00+02:00'))
    )
  })

  it('marks a past instant as isPast with all-zero values', () => {
    const now = Date.parse('2026-10-18T10:00:00+02:00')

    const result = calculateTimeUntil(target, now)

    expect(result).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true, total: 0 })
  })

  it('is past exactly at the target instant and not one second before', () => {
    expect(calculateTimeUntil(target, Date.parse('2026-10-17T16:29:59+02:00')).isPast).toBe(false)
    expect(calculateTimeUntil(target, Date.parse('2026-10-17T16:30:00+02:00')).isPast).toBe(true)
  })

  it('uses the current time when no reference time is given', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T14:30:00Z'))

    const result = calculateTimeUntil(target)

    expect(result.days).toBe(1)
    expect(result.hours).toBe(0)
    vi.useRealTimers()
  })
})
