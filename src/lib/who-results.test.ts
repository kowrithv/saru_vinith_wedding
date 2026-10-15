import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb } from './db'
import { ADMIN_COOKIE_NAME, adminCookieSecret, getOrCreateAdminSecret, signCookieValue } from './admin-auth'
import {
  RESULTS_KEY_HEADER,
  areResultsReleased,
  canSeeResults,
  resultsKey,
  setResultsReleased,
} from './who-results'

function requestWith(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/who-votes', { headers })
}

describe('who-results', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalSecret = process.env.ADMIN_SECRET
  const originalPassword = process.env.ADMIN_PASSWORD

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.ADMIN_SECRET = 'test-admin-secret'
    process.env.ADMIN_PASSWORD = 'test-admin-password'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    if (originalSecret === undefined) delete process.env.ADMIN_SECRET
    else process.env.ADMIN_SECRET = originalSecret
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD
    else process.env.ADMIN_PASSWORD = originalPassword
  })

  describe('release switch', () => {
    it('starts hidden', () => {
      expect(areResultsReleased(getDb())).toBe(false)
    })

    it('can be released and hidden again', () => {
      const db = getDb()
      setResultsReleased(db, true)
      expect(areResultsReleased(db)).toBe(true)
      setResultsReleased(db, false)
      expect(areResultsReleased(db)).toBe(false)
    })
  })

  describe('results key', () => {
    it('is a stable 64 character hex string', () => {
      const db = getDb()
      const key = resultsKey(db)
      expect(key).toMatch(/^[0-9a-f]{64}$/)
      expect(resultsKey(db)).toBe(key)
    })

    it('differs from every other key derived from the admin secret', () => {
      const db = getDb()
      expect(resultsKey(db)).not.toBe(adminCookieSecret(getOrCreateAdminSecret(db)))
      expect(resultsKey(db)).not.toBe(getOrCreateAdminSecret(db))
    })

    it('changes when the admin secret changes', () => {
      const db = getDb()
      const before = resultsKey(db)
      process.env.ADMIN_SECRET = 'another-admin-secret'
      expect(resultsKey(db)).not.toBe(before)
    })
  })

  describe('canSeeResults', () => {
    it('accepts the right key', () => {
      const db = getDb()
      expect(canSeeResults(requestWith({ [RESULTS_KEY_HEADER]: resultsKey(db) }), db)).toBe(true)
    })

    it('rejects a missing, wrong, short or non-hex key', () => {
      const db = getDb()
      const key = resultsKey(db)
      expect(canSeeResults(requestWith(), db)).toBe(false)
      expect(canSeeResults(requestWith({ [RESULTS_KEY_HEADER]: 'nope' }), db)).toBe(false)
      expect(canSeeResults(requestWith({ [RESULTS_KEY_HEADER]: key.slice(0, 63) }), db)).toBe(false)
      expect(canSeeResults(requestWith({ [RESULTS_KEY_HEADER]: key.toUpperCase() }), db)).toBe(false)
      expect(canSeeResults(requestWith({ [RESULTS_KEY_HEADER]: `${key.slice(0, 63)}g` }), db)).toBe(false)
    })

    it('accepts an admin session without a key', () => {
      const db = getDb()
      const expiresAt = Date.now() + 60_000
      const cookie = signCookieValue(expiresAt, adminCookieSecret(getOrCreateAdminSecret(db)))
      expect(canSeeResults(requestWith({ cookie: `${ADMIN_COOKIE_NAME}=${cookie}` }), db)).toBe(true)
    })
  })
})
