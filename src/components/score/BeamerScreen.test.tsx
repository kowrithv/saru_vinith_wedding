import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BeamerScreen from './BeamerScreen'
import type { LiveScore } from '@/lib/use-live-score'

const live = vi.hoisted(() => ({ current: null as unknown as LiveScore }))
vi.mock('@/lib/use-live-score', () => ({ useLiveScore: () => live.current }))
const wakeLock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/use-wake-lock', () => ({ useWakeLock: wakeLock }))

describe('BeamerScreen', () => {
  beforeEach(() => {
    wakeLock.mockClear()
    live.current = { score: { bride: 2, groom: 6, rev: 1 }, status: 'live', accept: vi.fn(), reconnect: vi.fn() }
  })

  it('shows the scoreboard and keeps the screen awake', () => {
    render(<BeamerScreen />)
    expect(screen.getByLabelText('Punkte Team Bride: 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Punkte Team Groom: 6')).toBeInTheDocument()
    expect(wakeLock).toHaveBeenCalled()
  })

  it('shows only a quiet background while it is still finding out whether there is a session (no flash of the board)', () => {
    live.current = { ...live.current, status: 'connecting', score: null }
    render(<BeamerScreen />)
    expect(screen.queryByLabelText(/Punkte Team/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Passwort')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Wird geladen')
  })

  it('keeps showing the scoreboard while it reconnects, once it has a score', () => {
    live.current = { ...live.current, status: 'connecting' }
    render(<BeamerScreen />)
    expect(screen.getByLabelText('Punkte Team Bride: 2')).toBeInTheDocument()
  })

  it('gives the login and the waiting screen the same backdrop as the board, so nothing flashes in between', () => {
    live.current = { ...live.current, status: 'login', score: null }
    const { container, rerender } = render(<BeamerScreen />)
    const loginBackdrop = (container.firstElementChild as HTMLElement).className
    live.current = { ...live.current, status: 'connecting', score: null }
    rerender(<BeamerScreen />)
    expect((container.firstElementChild as HTMLElement).className).toBe(loginBackdrop)
    expect(loginBackdrop).toContain('var(--backdrop-center)')
  })

  it('asks for the password instead of showing scores when there is no session', () => {
    live.current = { ...live.current, status: 'login', score: null }
    render(<BeamerScreen />)
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Punkte Team/)).not.toBeInTheDocument()
  })
})
