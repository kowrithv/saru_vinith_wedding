import { describe, expect, it } from 'vitest'
import { formatTime } from './format-time'

describe('formatTime', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(4)).toBe('00:04')
    expect(formatTime(75)).toBe('01:15')
    expect(formatTime(3599)).toBe('59:59')
  })

  it('keeps counting minutes beyond one hour', () => {
    expect(formatTime(5999)).toBe('99:59')
  })
})
