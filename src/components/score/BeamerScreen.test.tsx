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

  it('asks for the password instead of showing scores when there is no session', () => {
    live.current = { ...live.current, status: 'login', score: null }
    render(<BeamerScreen />)
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Punkte Team/)).not.toBeInTheDocument()
  })
})
