import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from './db'
import { GALLERY_COOKIE_NAME, createGallerySessionCookieValue } from './gallery-auth'
import { GuestRateLimiter, gateGuest, guestLimitKey } from './guest-limits'

const password = 'love'
// Sitzungen laufen ab: der Zeitpunkt muss in der Gegenwart liegen.
const base = Date.now()

function request(options: { session?: string; ip?: string } = {}): Request {
  const headers = new Headers()
  if (options.session) headers.set('cookie', `${GALLERY_COOKIE_NAME}=${options.session}`)
  if (options.ip) headers.set('x-forwarded-for', options.ip)
  return new Request('http://localhost/api/x', { headers })
}

describe('guest limits', () => {
  const originalPassword = process.env.GUEST_PASSWORD
  let db: ReturnType<typeof createDb>

  beforeEach(() => {
    process.env.GUEST_PASSWORD = password
    db = createDb(':memory:')
  })

  afterEach(() => {
    db.close()
    process.env.GUEST_PASSWORD = originalPassword
  })

  // Mit 200 Gästen im selben WLAN darf nicht die Adresse zählen, sondern das Gerät.
  describe('guestLimitKey', () => {
    it('counts a device with a valid session by its session, not by the address', () => {
      const a = createGallerySessionCookieValue(db, base + 1_000)
      const b = createGallerySessionCookieValue(db, base + 2_000)

      const keyA = guestLimitKey(request({ session: a, ip: '10.0.0.1' }), db)
      const keyB = guestLimitKey(request({ session: b, ip: '10.0.0.1' }), db)

      expect(keyA).not.toBe(keyB)
      expect(keyA.startsWith('s:')).toBe(true)
      expect(guestLimitKey(request({ session: a, ip: '10.0.0.99' }), db)).toBe(keyA)
    })

    it('does not put the cookie value itself into the key', () => {
      const session = createGallerySessionCookieValue(db, base + 1_000)
      expect(guestLimitKey(request({ session }), db)).not.toContain(session)
    })

    it('falls back to the address without a session', () => {
      expect(guestLimitKey(request({ ip: '10.0.0.7' }), db)).toBe('ip:10.0.0.7')
    })

    it('ignores a made-up session value (it would be a fresh bucket every time)', () => {
      expect(guestLimitKey(request({ session: 'erfunden.signatur', ip: '10.0.0.7' }), db)).toBe('ip:10.0.0.7')
    })
  })

  describe('GuestRateLimiter', () => {
    const limiter = () => new GuestRateLimiter({ perDevice: 3, perAddress: 10, windowMs: 60_000 })

    it('gives every device its own allowance although they share an address', () => {
      const guests = limiter()
      const sessions = [1, 2, 3, 4, 5].map((i) => createGallerySessionCookieValue(db, base + i * 1_000))

      for (const session of sessions) {
        for (let i = 0; i < 3; i++) {
          expect(guests.check(request({ session, ip: '10.0.0.1' }), db).allowed).toBe(true)
        }
      }
    })

    it('stops one device after its allowance without touching the others', () => {
      const guests = limiter()
      const noisy = createGallerySessionCookieValue(db, base + 1_000)
      const quiet = createGallerySessionCookieValue(db, base + 2_000)

      for (let i = 0; i < 3; i++) guests.check(request({ session: noisy, ip: '10.0.0.1' }), db)

      expect(guests.check(request({ session: noisy, ip: '10.0.0.1' }), db).allowed).toBe(false)
      expect(guests.check(request({ session: quiet, ip: '10.0.0.1' }), db).allowed).toBe(true)
    })

    it('uses the larger address allowance for requests without a session', () => {
      const guests = limiter()
      const results = Array.from({ length: 11 }, () => guests.check(request({ ip: '10.0.0.1' }), db).allowed)
      expect(results.slice(0, 10).every(Boolean)).toBe(true)
      expect(results[10]).toBe(false)
    })

    it('counts a weight, e.g. the number of photos of one request', () => {
      const guests = limiter()
      const session = createGallerySessionCookieValue(db, base + 1_000)
      expect(guests.check(request({ session }), db, 2).allowed).toBe(true)
      expect(guests.check(request({ session }), db, 2).allowed).toBe(false)
      expect(guests.check(request({ session }), db, 1).allowed).toBe(true)
    })
  })

  // Ein einfaches Kennwort schützt nicht gegen gezieltes Raten; die Grenze soll
  // nur lautes Probieren bremsen und darf nie die Gäste aussperren.
  describe('gateGuest', () => {
    const attempt = (candidate: unknown, ip: string, session?: string) =>
      gateGuest(request({ ip, session }), db, candidate)

    it('lets the right password through and asks for a session', () => {
      expect(attempt('LOVE', '10.1.0.1')).toEqual({ ok: true, issueSession: true })
    })

    it('lets a valid session through without a password', () => {
      const session = createGallerySessionCookieValue(db, base + 9_000)
      expect(attempt(undefined, '10.1.0.2', session)).toEqual({ ok: true, issueSession: false })
    })

    it('answers a wrong password with 401 up to 20 times and then with 429 and a wait time', () => {
      const answers = Array.from({ length: 21 }, () => attempt('falsch', '10.1.0.3'))
      expect(answers.slice(0, 20).every((answer) => !answer.ok && answer.status === 401)).toBe(true)
      const last = answers[20]
      expect(last).toMatchObject({ ok: false, status: 429, error: expect.stringMatching(/minute/i) })
      expect((last as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0)
    })

    it('never turns away the right password, even from an address that is locked', () => {
      for (let i = 0; i < 25; i++) attempt('falsch', '10.1.0.4')
      expect(attempt('love', '10.1.0.4')).toEqual({ ok: true, issueSession: true })
    })

    it('counts wrong passwords per address only', () => {
      for (let i = 0; i < 25; i++) attempt('falsch', '10.1.0.5')
      const other = attempt('falsch', '10.1.0.6')
      expect(other.ok === false && other.status).toBe(401)
    })
  })
})
