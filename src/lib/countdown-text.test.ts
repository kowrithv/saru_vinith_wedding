import { describe, expect, it } from 'vitest'
import { quietCountdownSentence } from './countdown-text'

describe('quietCountdownSentence', () => {
  it('names days, hours and minutes with "und" before the last', () => {
    expect(quietCountdownSentence({ days: 2, hours: 6, minutes: 30 })).toBe('Noch 2 Tage, 6 Stunden und 30 Minuten')
  })

  it('uses the singular for one', () => {
    expect(quietCountdownSentence({ days: 1, hours: 1, minutes: 1 })).toBe('Noch 1 Tag, 1 Stunde und 1 Minute')
  })

  it('leaves out the days on the last day', () => {
    expect(quietCountdownSentence({ days: 0, hours: 15, minutes: 5 })).toBe('Noch 15 Stunden und 5 Minuten')
  })

  it('keeps zero hours between whole days and minutes', () => {
    expect(quietCountdownSentence({ days: 2, hours: 0, minutes: 5 })).toBe('Noch 2 Tage, 0 Stunden und 5 Minuten')
  })

  it('shortens to minutes in the last hour', () => {
    expect(quietCountdownSentence({ days: 0, hours: 0, minutes: 5 })).toBe('Noch 5 Minuten')
  })

  it('says it is about to start in the last minute', () => {
    expect(quietCountdownSentence({ days: 0, hours: 0, minutes: 0 })).toBe('Gleich geht es los')
  })
})
