import { describe, expect, it } from 'vitest'
import { RateLimiter } from './rate-limit'

describe('RateLimiter', () => {
  it('allows up to maxAttempts requests within the window', () => {
    const limiter = new RateLimiter({ maxAttempts: 3, windowMs: 1000 })
    expect(limiter.check('ip-1').allowed).toBe(true)
    expect(limiter.check('ip-1').allowed).toBe(true)
    expect(limiter.check('ip-1').allowed).toBe(true)
  })

  it('rejects the request after maxAttempts within the window', () => {
    const limiter = new RateLimiter({ maxAttempts: 2, windowMs: 1000 })
    limiter.check('ip-1')
    limiter.check('ip-1')
    const result = limiter.check('ip-1')
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('allows requests again once the window has fully elapsed', () => {
    let current = 0
    const limiter = new RateLimiter({
      maxAttempts: 1,
      windowMs: 1000,
      now: () => current,
    })
    limiter.check('ip-1')
    current = 999
    expect(limiter.check('ip-1').allowed).toBe(false)
    current = 1000
    expect(limiter.check('ip-1').allowed).toBe(true)
  })

  it('drops expired buckets so the map cannot grow without bound', () => {
    let now = 0
    const limiter = new RateLimiter({ maxAttempts: 3, windowMs: 1000, now: () => now })
    limiter.check('a')
    limiter.check('b')
    expect(limiter.size).toBe(2)

    now = 1000
    limiter.check('c')

    expect(limiter.size).toBe(1)
  })

  it('keeps buckets that are still inside their window when it sweeps', () => {
    let now = 0
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 1000, now: () => now })
    limiter.check('a')
    now = 600
    limiter.check('b')
    now = 1000
    limiter.check('c')

    expect(limiter.size).toBe(2)
    // b zählt weiter: sein Fenster läuft erst bei 1600 ab.
    expect(limiter.check('b').allowed).toBe(false)
  })

  it('tracks separate keys independently', () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 1000 })
    expect(limiter.check('ip-1').allowed).toBe(true)
    expect(limiter.check('ip-2').allowed).toBe(true)
    expect(limiter.check('ip-1').allowed).toBe(false)
  })

  describe('weights', () => {
    it('counts the given weight against the allowance', () => {
      const limiter = new RateLimiter({ maxAttempts: 10, windowMs: 1000 })
      expect(limiter.check('a', 6).allowed).toBe(true)
      expect(limiter.check('a', 4).allowed).toBe(true)
      expect(limiter.check('a', 1).allowed).toBe(false)
    })

    it('rejects a single request that is heavier than the whole allowance', () => {
      const limiter = new RateLimiter({ maxAttempts: 10, windowMs: 1000 })
      expect(limiter.check('a', 11).allowed).toBe(false)
    })

    it('does not use up the allowance with a rejected heavy request', () => {
      const limiter = new RateLimiter({ maxAttempts: 10, windowMs: 1000 })
      expect(limiter.check('a', 8).allowed).toBe(true)
      expect(limiter.check('a', 5).allowed).toBe(false)
      expect(limiter.check('a', 2).allowed).toBe(true)
    })
  })
})
