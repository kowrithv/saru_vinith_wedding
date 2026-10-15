import { afterEach, describe, expect, it } from 'vitest'
import { createDb } from './db'
import {
  ADMIN_COOKIE_NAME,
  adminCookieSecret,
  getOrCreateAdminSecret,
  hashPassword,
  isAdminRequest,
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

describe('isAdminRequest', () => {
  function requestWithCookie(value?: string): Request {
    const headers = new Headers()
    if (value !== undefined) {
      headers.set('cookie', `${ADMIN_COOKIE_NAME}=${value}`)
    }
    return new Request('http://localhost/api/guestbook/1', { headers })
  }

  it('accepts a request with a valid, unexpired admin cookie', () => {
    const db = createDb(':memory:')
    const secret = getOrCreateAdminSecret(db)
    const expiresAt = Date.now() + 1000
    const value = signCookieValue(expiresAt, adminCookieSecret(secret))

    expect(isAdminRequest(requestWithCookie(value), db)).toBe(true)
    db.close()
  })

  it('rejects a request with no cookie at all', () => {
    const db = createDb(':memory:')
    getOrCreateAdminSecret(db)
    expect(isAdminRequest(requestWithCookie(undefined), db)).toBe(false)
    db.close()
  })

  it('rejects a request with an expired cookie', () => {
    const db = createDb(':memory:')
    const secret = getOrCreateAdminSecret(db)
    const expiresAt = Date.now() - 1000
    const value = signCookieValue(expiresAt, adminCookieSecret(secret))

    expect(isAdminRequest(requestWithCookie(value), db)).toBe(false)
    db.close()
  })

  it('rejects a request with a tampered cookie', () => {
    const db = createDb(':memory:')
    const secret = getOrCreateAdminSecret(db)
    const expiresAt = Date.now() + 1000
    const value = signCookieValue(expiresAt, adminCookieSecret(secret))
    const tampered = value.slice(0, -1) + (value.endsWith('0') ? '1' : '0')

    expect(isAdminRequest(requestWithCookie(tampered), db)).toBe(false)
    db.close()
  })
})

// Ein Wechsel des Admin-Kennworts beendet alle Admin-Sitzungen: das Cookie
// hängt am Kennwort, nicht nur am (gleichbleibenden) Signierschlüssel.
describe('admin cookie and the admin password', () => {
  const original = process.env.ADMIN_PASSWORD

  afterEach(() => {
    process.env.ADMIN_PASSWORD = original
  })

  function requestWith(value: string): Request {
    return new Request('http://localhost/api/x', { headers: { cookie: `${ADMIN_COOKIE_NAME}=${value}` } })
  }

  it('invalidates a session issued under the old password', () => {
    const db = createDb(':memory:')
    process.env.ADMIN_PASSWORD = 'altes-kennwort'
    const cookie = signCookieValue(Date.now() + 60_000, adminCookieSecret(getOrCreateAdminSecret(db)))
    expect(isAdminRequest(requestWith(cookie), db)).toBe(true)

    process.env.ADMIN_PASSWORD = 'neues-kennwort'

    expect(isAdminRequest(requestWith(cookie), db)).toBe(false)
    db.close()
  })

  it('does not accept a cookie signed with the raw secret alone', () => {
    const db = createDb(':memory:')
    process.env.ADMIN_PASSWORD = 'kennwort'
    const cookie = signCookieValue(Date.now() + 60_000, getOrCreateAdminSecret(db))
    expect(isAdminRequest(requestWith(cookie), db)).toBe(false)
    db.close()
  })

  it('derives a different key than the raw secret', () => {
    process.env.ADMIN_PASSWORD = 'kennwort'
    expect(adminCookieSecret('geheim')).not.toBe('geheim')
    expect(adminCookieSecret('geheim')).toBe(adminCookieSecret('geheim'))
  })
})
