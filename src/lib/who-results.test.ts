import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb } from './db'
import { ADMIN_COOKIE_NAME, adminCookieSecret, getOrCreateAdminSecret, signCookieValue } from './admin-auth'
import {
  RESULTS_KEY_HEADER,
  WHO_PHASES,
  areResultsReleased,
  canSeeResults,
  getWhoPhase,
  resultsAccess,
  resultsKey,
  setResultsReleased,
  setWhoPhase,
} from './who-results'
import { isFeatureLocked, setFeatureLocked } from './app-config'
import { RESULTS_WORDS } from './who-results-words'

function requestWith(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/who-votes', { headers })
}

describe('who-results', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalSecret = process.env.ADMIN_SECRET
  const originalPassword = process.env.ADMIN_PASSWORD

  beforeEach(() => {
    delete globalThis.__appDb
    delete globalThis.__resultsCodeFailures
    process.env.DATABASE_PATH = ':memory:'
    process.env.ADMIN_SECRET = 'test-admin-secret'
    process.env.ADMIN_PASSWORD = 'test-admin-password'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    delete globalThis.__resultsCodeFailures
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

  describe('phase', () => {
    it('starts with voting', () => {
      expect(getWhoPhase(getDb())).toBe('voting')
    })

    it('goes voting -> closed -> released and back', () => {
      const db = getDb()
      setWhoPhase(db, 'closed')
      expect(getWhoPhase(db)).toBe('closed')
      expect(isFeatureLocked(db, 'who_votes')).toBe(true)
      expect(areResultsReleased(db)).toBe(false)

      setWhoPhase(db, 'released')
      expect(getWhoPhase(db)).toBe('released')
      expect(areResultsReleased(db)).toBe(true)

      setWhoPhase(db, 'closed')
      expect(getWhoPhase(db)).toBe('closed')
      expect(areResultsReleased(db)).toBe(false)

      setWhoPhase(db, 'voting')
      expect(getWhoPhase(db)).toBe('voting')
      expect(isFeatureLocked(db, 'who_votes')).toBe(false)
    })

    it('treats the old write lock for the vote as the closed phase', () => {
      const db = getDb()
      setFeatureLocked(db, 'who_votes', true)
      expect(getWhoPhase(db)).toBe('closed')
    })

    it('lists the phases in their order', () => {
      expect(WHO_PHASES).toEqual(['voting', 'closed', 'released'])
    })
  })

  describe('results key', () => {
    it('is a stable word from the list', () => {
      const db = getDb()
      const key = resultsKey(db)
      expect(RESULTS_WORDS).toContain(key)
      expect(resultsKey(db)).toBe(key)
    })

    it('changes with the admin secret (over many secrets it is not always the same word)', () => {
      const db = getDb()
      const words = new Set<string>()
      for (let index = 0; index < 30; index += 1) {
        process.env.ADMIN_SECRET = `secret-${index}`
        words.add(resultsKey(db))
      }
      expect(words.size).toBeGreaterThan(10)
    })
  })

  describe('canSeeResults', () => {
    it('accepts the right word in every typed form', () => {
      const db = getDb()
      const key = resultsKey(db)
      for (const typed of [key, key.toUpperCase(), `${key[0].toUpperCase()}${key.slice(1)}`, ` ${key} `]) {
        expect(canSeeResults(requestWith({ [RESULTS_KEY_HEADER]: typed }), db)).toBe(true)
      }
    })

    it('rejects a missing, wrong, short, long or malformed word', () => {
      const db = getDb()
      const key = resultsKey(db)
      expect(canSeeResults(requestWith(), db)).toBe(false)
      for (const wrong of ['zzzzzz', key.slice(0, key.length - 1), `${key}x`, `${key}1`, 'zwei woerter']) {
        expect(canSeeResults(requestWith({ [RESULTS_KEY_HEADER]: wrong }), db)).toBe(false)
      }
    })

    it('accepts an admin session without a word', () => {
      const db = getDb()
      const cookie = signCookieValue(Date.now() + 60_000, adminCookieSecret(getOrCreateAdminSecret(db)))
      expect(canSeeResults(requestWith({ cookie: `${ADMIN_COOKIE_NAME}=${cookie}` }), db)).toBe(true)
    })
  })

  describe('limit for wrong words', () => {
    const fromAddress = (address: string, code: string) =>
      requestWith({ [RESULTS_KEY_HEADER]: code, 'x-forwarded-for': address })

    it('does not count requests without a word', () => {
      const db = getDb()
      for (let index = 0; index < 100; index += 1) {
        expect(resultsAccess(fromAddress('10.0.0.1', ''), db).kind).toBe('hidden')
      }
      // Danach bleibt das Konto voll: erst die Fehlversuche zählen.
      expect(resultsAccess(fromAddress('10.0.0.1', 'zzzzzz'), db)).toEqual({ kind: 'hidden', codeGiven: true })
    })

    it('blocks an address after too many wrong words', () => {
      const db = getDb()
      let blocked: ReturnType<typeof resultsAccess> | null = null
      for (let index = 0; index < 40; index += 1) {
        const access = resultsAccess(fromAddress('10.0.0.2', 'zzzzzz'), db)
        if (access.kind === 'blocked') {
          blocked = access
          break
        }
      }
      expect(blocked).toMatchObject({ kind: 'blocked' })
      expect((blocked as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0)
    })

    it('never rejects the right word, even from a blocked address', () => {
      const db = getDb()
      for (let index = 0; index < 40; index += 1) resultsAccess(fromAddress('10.0.0.3', 'zzzzzz'), db)
      expect(resultsAccess(fromAddress('10.0.0.3', 'yyyyyy'), db).kind).toBe('blocked')

      expect(resultsAccess(fromAddress('10.0.0.3', resultsKey(db)), db)).toEqual({ kind: 'allowed' })
    })

    it('counts each address on its own', () => {
      const db = getDb()
      for (let index = 0; index < 40; index += 1) resultsAccess(fromAddress('10.0.0.4', 'zzzzzz'), db)

      expect(resultsAccess(fromAddress('10.0.0.5', 'zzzzzz'), db).kind).toBe('hidden')
    })
  })
})
