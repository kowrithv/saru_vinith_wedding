import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { usePolling } from './use-polling'

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

function Harness({ fetchFn }: { fetchFn: () => void }) {
  usePolling(fetchFn, { minDelayMs: 1000, maxDelayMs: 4000, backoffFactor: 2 })
  return null
}

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setHidden(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls fetchFn immediately on mount', () => {
    const fetchFn = vi.fn()
    render(<Harness fetchFn={fetchFn} />)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('backs off: second call after minDelayMs, third call after minDelayMs * factor', () => {
    const fetchFn = vi.fn()
    render(<Harness fetchFn={fetchFn} />)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(1999)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1)
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('stops polling while the tab is hidden', () => {
    const fetchFn = vi.fn()
    render(<Harness fetchFn={fetchFn} />)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    setHidden(true)
    vi.advanceTimersByTime(10000)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('resumes immediately at the shortest interval when the tab becomes visible again', () => {
    const fetchFn = vi.fn()
    render(<Harness fetchFn={fetchFn} />)
    vi.advanceTimersByTime(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    setHidden(true)
    vi.advanceTimersByTime(10000)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    setHidden(false)
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('stops calling fetchFn after unmount', () => {
    const fetchFn = vi.fn()
    const { unmount } = render(<Harness fetchFn={fetchFn} />)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    unmount()
    vi.advanceTimersByTime(10000)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
