import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useNowSecond } from './use-now-second'

function Probe({ stopAtMs }: { stopAtMs?: number }) {
  const nowSecond = useNowSecond(stopAtMs)
  return <p>{nowSecond === null ? 'unbekannt' : String(nowSecond)}</p>
}

describe('useNowSecond', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is unknown while rendering on the server, so server and first client render agree', () => {
    expect(renderToString(<Probe />)).toContain('unbekannt')
  })

  it('returns the current time in whole seconds and ticks along', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T14:00:00Z'))
    render(<Probe />)
    const start = Math.floor(Date.parse('2026-10-17T14:00:00Z') / 1000)
    expect(screen.getByText(String(start))).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(2000)

    expect(screen.getByText(String(start + 2))).toBeInTheDocument()
  })

  it('stops its timer once the given instant has passed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T14:29:59Z'))
    render(<Probe stopAtMs={Date.parse('2026-10-17T14:30:00Z')} />)

    await vi.advanceTimersByTimeAsync(1500)

    expect(vi.getTimerCount()).toBe(0)
  })

  it('releases its timer on unmount', () => {
    vi.useFakeTimers()
    const { unmount } = render(<Probe />)
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  // Vorschau der Zustände (?zeit=heute|feier|danach), siehe time-preview.ts.
  describe('time preview', () => {
    afterEach(() => {
      window.sessionStorage.clear()
      window.history.replaceState(null, '', '/')
    })

    it('shows the preview instant instead of the real time and ticks along', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
      window.history.replaceState(null, '', '/?zeit=feier')
      render(<Probe />)
      const start = Math.floor(Date.parse('2026-10-17T18:00:00+02:00') / 1000)
      expect(screen.getByText(String(start))).toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(3000)

      expect(screen.getByText(String(start + 3))).toBeInTheDocument()
    })
  })
})
