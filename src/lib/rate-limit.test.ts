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

  it('tracks separate keys independently', () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 1000 })
    expect(limiter.check('ip-1').allowed).toBe(true)
    expect(limiter.check('ip-2').allowed).toBe(true)
    expect(limiter.check('ip-1').allowed).toBe(false)
  })
})
