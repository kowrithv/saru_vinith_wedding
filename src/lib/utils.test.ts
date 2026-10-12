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
  it('computes days/hours/minutes/seconds until a future date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T10:00:00'))

    const result = calculateTimeUntil('2026-10-17', '16:30')

    expect(result.isPast).toBe(false)
    expect(result.days).toBe(2)
    expect(result.hours).toBe(6)
    expect(result.minutes).toBe(30)
    vi.useRealTimers()
  })

  it('marks a past date as isPast with all-zero values', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T10:00:00'))

    const result = calculateTimeUntil('2026-10-17', '16:30')

    expect(result.isPast).toBe(true)
    expect(result.days).toBe(0)
    expect(result.hours).toBe(0)
    expect(result.minutes).toBe(0)
    expect(result.seconds).toBe(0)
    vi.useRealTimers()
  })

  it('defaults to midnight when no time is given', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T23:00:00'))

    const result = calculateTimeUntil('2026-10-17')

    expect(result.isPast).toBe(false)
    expect(result.hours).toBe(1)
    vi.useRealTimers()
  })
})
