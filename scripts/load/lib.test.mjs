// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { guestIp, isLocalUrl, percentile, runPool, summarize } from './lib.mjs'

describe('percentile / summarize', () => {
  it('picks the nearest-rank percentile of a sorted list', () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    expect(percentile(sorted, 50)).toBe(50)
    expect(percentile(sorted, 95)).toBe(100)
    expect(percentile(sorted, 0)).toBe(10)
  })

  it('summarises latencies', () => {
    expect(summarize([30, 10, 20])).toEqual({ count: 3, mean: 20, p50: 20, p95: 30, p99: 30, max: 30 })
  })

  it('handles an empty list', () => {
    expect(summarize([])).toEqual({ count: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 })
  })
})

describe('runPool', () => {
  it('runs every item and never exceeds the concurrency limit', async () => {
    let running = 0
    let peak = 0
    const results = await runPool(25, 5, async (i) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 2))
      running--
      return i * 2
    })
    expect(results).toEqual(Array.from({ length: 25 }, (_, i) => i * 2))
    expect(peak).toBeLessThanOrEqual(5)
    expect(peak).toBeGreaterThan(1)
  })

  it('keeps going when one worker throws and reports the error as a result', async () => {
    const results = await runPool(4, 2, async (i) => {
      if (i === 2) throw new Error('kaputt')
      return 'ok'
    })
    expect(results[2]).toMatchObject({ error: 'kaputt' })
    expect(results.filter((r) => r === 'ok')).toHaveLength(3)
  })
})

describe('helpers', () => {
  it('gives every simulated guest its own address', () => {
    const ips = new Set(Array.from({ length: 600 }, (_, i) => guestIp(i)))
    expect(ips.size).toBe(600)
    expect(guestIp(0)).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
  })

  it('recognises local test servers, because the scenarios write data', () => {
    expect(isLocalUrl('http://localhost:3000')).toBe(true)
    expect(isLocalUrl('http://127.0.0.1:3124')).toBe(true)
    expect(isLocalUrl('https://vsjourney.de')).toBe(false)
  })
})
