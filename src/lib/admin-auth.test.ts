import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import {
  getOrCreateAdminSecret,
  hashPassword,
  signCookieValue,
  verifyCookieValue,
  verifyPassword,
} from './admin-auth'

describe('verifyPassword', () => {
  it('returns true for the correct password', () => {
    expect(verifyPassword('geheim123', 'geheim123')).toBe(true)
  })

  it('returns false for an incorrect password', () => {
    expect(verifyPassword('falsch', 'geheim123')).toBe(false)
  })

  it('compares fixed-length hashes rather than the raw inputs', () => {
    // Unterschiedliche Längen dürfen nicht an timingSafeEqual
    // durchschlagen, weil beide Seiten zuerst gehasht werden.
    expect(() => verifyPassword('a', 'ein-sehr-langes-passwort')).not.toThrow()
    expect(verifyPassword('a', 'ein-sehr-langes-passwort')).toBe(false)
  })
})

describe('hashPassword', () => {
  it('produces a 64-character hex digest', () => {
    expect(hashPassword('x')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('getOrCreateAdminSecret', () => {
  const originalEnvSecret = process.env.ADMIN_SECRET

  afterEach(() => {
    process.env.ADMIN_SECRET = originalEnvSecret
  })

  it('prefers the ADMIN_SECRET env var when set', () => {
    process.env.ADMIN_SECRET = 'from-env'
    const db = createDb(':memory:')
    expect(getOrCreateAdminSecret(db)).toBe('from-env')
    db.close()
  })

  it('generates and persists a secret when neither env nor DB has one', () => {
    delete process.env.ADMIN_SECRET
    const db = createDb(':memory:')
    const generated = getOrCreateAdminSecret(db)
    expect(generated).toMatch(/^[0-9a-f]{64}$/)
    expect(getOrCreateAdminSecret(db)).toBe(generated)
    db.close()
  })
})

describe('signCookieValue / verifyCookieValue', () => {
  it('verifies a freshly signed, not-yet-expired cookie', () => {
    const expiresAt = Date.now() + 10_000
    const value = signCookieValue(expiresAt, 'secret')
    expect(verifyCookieValue(value, 'secret', Date.now())).toBe(true)
  })

  it('rejects a cookie signed with a different secret', () => {
    const expiresAt = Date.now() + 10_000
    const value = signCookieValue(expiresAt, 'secret-a')
    expect(verifyCookieValue(value, 'secret-b', Date.now())).toBe(false)
  })

  it('rejects an expired cookie', () => {
    const expiresAt = Date.now() - 1
    const value = signCookieValue(expiresAt, 'secret')
    expect(verifyCookieValue(value, 'secret', Date.now())).toBe(false)
  })

  it('rejects a malformed cookie value without throwing', () => {
    expect(() => verifyCookieValue('garbage', 'secret')).not.toThrow()
    expect(verifyCookieValue('garbage', 'secret')).toBe(false)
  })

  it('rejects a tampered signature of different length without throwing', () => {
    const expiresAt = Date.now() + 10_000
    const value = signCookieValue(expiresAt, 'secret')
    const [expiresAtPart] = value.split('.')
    const tampered = `${expiresAtPart}.ab`
    expect(() => verifyCookieValue(tampered, 'secret')).not.toThrow()
    expect(verifyCookieValue(tampered, 'secret')).toBe(false)
  })
})
