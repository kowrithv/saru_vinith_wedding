import { describe, expect, it } from 'vitest'
import { formatPhotoMoment, formatTime } from './format-time'

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

describe('formatPhotoMoment', () => {
  it('writes day, month and the German clock time', () => {
    expect(formatPhotoMoment('2026-10-12T10:00:00.000Z')).toBe('12.10. um 12:00 Uhr')
  })

  it('uses German time even when the date falls on the other side of midnight in UTC', () => {
    expect(formatPhotoMoment('2026-10-17T22:30:00.000Z')).toBe('18.10. um 00:30 Uhr')
  })

  it('returns an empty string for an unusable date', () => {
    expect(formatPhotoMoment('kein Datum')).toBe('')
  })
})
