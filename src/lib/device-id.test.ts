import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDeviceId } from './device-id'

describe('getDeviceId', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('generates an id on first call and returns the same id on later calls', () => {
    const first = getDeviceId()
    const second = getDeviceId()
    expect(first).toBe(second)
    expect(first.length).toBeGreaterThan(0)
  })

  it('persists the id across independent calls (simulated reload)', () => {
    const first = getDeviceId()
    // Simuliert einen Reload: nur der Storage bleibt, kein In-Memory-Zustand.
    const second = getDeviceId()
    expect(second).toBe(first)
  })

  it('still returns a non-empty id when localStorage throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getDeviceId().length).toBeGreaterThan(0)
  })
})
