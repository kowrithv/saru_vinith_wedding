import { describe, expect, it } from 'vitest'
import { normalizeGuestPassword, verifyGuestPassword } from './guest-password'

describe('verifyGuestPassword', () => {
  it('accepts the exact password', () => {
    expect(verifyGuestPassword('Hochzeit', 'Hochzeit')).toBe(true)
  })

  it('ignores upper and lower case (Handy-Tastaturen schreiben groß)', () => {
    expect(verifyGuestPassword('hochzeit', 'Hochzeit')).toBe(true)
    expect(verifyGuestPassword('HOCHZEIT', 'hochzeit')).toBe(true)
  })

  it('ignores whitespace around the password (Autovervollständigung)', () => {
    expect(verifyGuestPassword('  Hochzeit ', 'Hochzeit')).toBe(true)
    expect(verifyGuestPassword('Hochzeit', ' Hochzeit\n')).toBe(true)
  })

  it('treats composed and decomposed umlauts as the same', () => {
    expect(verifyGuestPassword('Für-uns', 'Für-uns')).toBe(true)
  })

  it('rejects a different password', () => {
    expect(verifyGuestPassword('Hochzeit2', 'Hochzeit')).toBe(false)
    expect(verifyGuestPassword('Hochzei', 'Hochzeit')).toBe(false)
  })

  it('never accepts an empty candidate', () => {
    expect(verifyGuestPassword('', 'Hochzeit')).toBe(false)
    expect(verifyGuestPassword('   ', 'Hochzeit')).toBe(false)
  })

  it('never accepts anything when no password is configured', () => {
    expect(verifyGuestPassword('', undefined)).toBe(false)
    expect(verifyGuestPassword('irgendwas', undefined)).toBe(false)
    expect(verifyGuestPassword('', '')).toBe(false)
  })

  it('does not collapse inner whitespace', () => {
    expect(verifyGuestPassword('ja  sagen', 'ja sagen')).toBe(false)
  })
})

describe('normalizeGuestPassword', () => {
  it('trims and lowercases', () => {
    expect(normalizeGuestPassword('  AbC ')).toBe('abc')
  })
})
