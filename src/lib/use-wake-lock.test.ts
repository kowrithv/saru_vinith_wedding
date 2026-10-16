import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useWakeLock } from './use-wake-lock'

function stubWakeLock() {
  const release = vi.fn(async () => {})
  const request = vi.fn(async () => ({ release }))
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
  return { request, release }
}

describe('useWakeLock', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock')
    vi.restoreAllMocks()
  })

  it('keeps the screen awake while mounted and lets go on unmount', async () => {
    const { request, release } = stubWakeLock()
    const { unmount } = renderHook(() => useWakeLock())
    await act(async () => {})
    expect(request).toHaveBeenCalledWith('screen')
    unmount()
    expect(release).toHaveBeenCalled()
  })

  it('asks again when the tab becomes visible (the browser drops the lock in the background)', async () => {
    const { request } = stubWakeLock()
    renderHook(() => useWakeLock())
    await act(async () => {})
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does nothing in a browser without the feature', async () => {
    expect(() => renderHook(() => useWakeLock())).not.toThrow()
  })

  it('survives a refused request (e.g. low battery)', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: vi.fn().mockRejectedValue(new Error('NotAllowedError')) },
      configurable: true,
    })
    expect(() => renderHook(() => useWakeLock())).not.toThrow()
    await act(async () => {})
  })
})
