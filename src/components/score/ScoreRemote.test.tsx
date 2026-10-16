import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScoreRemote from './ScoreRemote'
import { SCORE_COLORS } from '@/lib/score-colors'
import { bodyOf, callsTo, mockFetchRoutes as mockFetch } from '@/test-utils/mock-fetch'
import type { LiveScore } from '@/lib/use-live-score'

const live = vi.hoisted(() => ({ current: null as unknown as LiveScore }))
vi.mock('@/lib/use-live-score', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/use-live-score')>()),
  useLiveScore: () => live.current,
}))

function setLive(overrides: Partial<LiveScore> = {}) {
  live.current = {
    score: { bride: 3, groom: 5, rev: 8 },
    status: 'live',
    accept: vi.fn(),
    reconnect: vi.fn(),
    ...overrides,
  }
  return live.current
}

describe('ScoreRemote', () => {
  beforeEach(() => {
    setLive()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for the password first when there is no session', () => {
    setLive({ status: 'login' })
    render(<ScoreRemote />)
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Punkt/ })).not.toBeInTheDocument()
  })

  it('reconnects after a successful login', async () => {
    const state = setLive({ status: 'login' })
    mockFetch({ '/api/score/login': { body: { success: true } } })
    render(<ScoreRemote />)
    await userEvent.type(screen.getByLabelText('Passwort'), 'Torte')
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
    await waitFor(() => expect(state.reconnect).toHaveBeenCalled())
  })

  it('uses the same team colours as the beamer, so the buttons match what the screen shows', () => {
    render(<ScoreRemote />)
    const main = screen.getByRole('main')
    expect(main.style.getPropertyValue('--bride')).toBe(SCORE_COLORS.bride)
    expect(main.style.getPropertyValue('--groom')).toBe(SCORE_COLORS.groom)
  })

  it('shows nothing but a quiet background while it is still finding out whether there is a session', () => {
    setLive({ status: 'connecting', score: null })
    render(<ScoreRemote />)
    expect(screen.queryByRole('button', { name: /Punkt/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Passwort')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Wird geladen')
  })

  it('shows both scores', () => {
    render(<ScoreRemote />)
    expect(screen.getByLabelText('Punkte Team Bride: 3')).toBeInTheDocument()
    expect(screen.getByLabelText('Punkte Team Groom: 5')).toBeInTheDocument()
  })

  it('sends +1 for a team and takes over the answer', async () => {
    const state = setLive()
    const fetchMock = mockFetch({ '/api/score': { body: { bride: 4, groom: 5, rev: 9 } } })
    render(<ScoreRemote />)

    await userEvent.click(screen.getByRole('button', { name: 'Team Bride: 1 Punkt dazu' }))

    await waitFor(() => expect(state.accept).toHaveBeenCalledWith({ bride: 4, groom: 5, rev: 9 }))
    expect(bodyOf(callsTo(fetchMock, '/api/score')[0])).toEqual({ action: 'change', team: 'bride', delta: 1 })
  })

  it('sends -1 for the other team', async () => {
    const fetchMock = mockFetch({ '/api/score': { body: { bride: 3, groom: 4, rev: 9 } } })
    render(<ScoreRemote />)
    await userEvent.click(screen.getByRole('button', { name: 'Team Groom: 1 Punkt weg' }))
    await waitFor(() => expect(callsTo(fetchMock, '/api/score')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, '/api/score')[0])).toEqual({ action: 'change', team: 'groom', delta: -1 })
  })

  it('keeps every tap: a second tap does not wait for the first answer', async () => {
    const fetchMock = mockFetch({ '/api/score': { body: { bride: 5, groom: 5, rev: 10 } } })
    render(<ScoreRemote />)
    const plus = screen.getByRole('button', { name: 'Team Bride: 1 Punkt dazu' })
    await userEvent.click(plus)
    await userEvent.click(plus)
    await waitFor(() => expect(callsTo(fetchMock, '/api/score')).toHaveLength(2))
  })

  it('says so when a tap was not saved, and does not take over anything', async () => {
    const state = setLive()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<ScoreRemote />)
    await userEvent.click(screen.getByRole('button', { name: 'Team Bride: 1 Punkt dazu' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nicht gespeichert')
    expect(state.accept).not.toHaveBeenCalled()
  })

  it('goes back to the login when the session has ended', async () => {
    const state = setLive()
    mockFetch({ '/api/score': { status: 401, body: { error: 'Nicht angemeldet.' } } })
    render(<ScoreRemote />)
    await userEvent.click(screen.getByRole('button', { name: 'Team Bride: 1 Punkt dazu' }))
    await waitFor(() => expect(state.reconnect).toHaveBeenCalled())
  })

  it('resets only after a confirmation', async () => {
    const state = setLive()
    const fetchMock = mockFetch({ '/api/score': { body: { bride: 0, groom: 0, rev: 9 } } })
    render(<ScoreRemote />)

    await userEvent.click(screen.getByRole('button', { name: 'Auf 0 zurücksetzen' }))
    expect(callsTo(fetchMock, '/api/score')).toHaveLength(0)
    expect(screen.getByText('Wirklich beide Teams auf 0 setzen?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByText('Wirklich beide Teams auf 0 setzen?')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/score')).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Auf 0 zurücksetzen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ja, auf 0 setzen' }))
    await waitFor(() => expect(state.accept).toHaveBeenCalledWith({ bride: 0, groom: 0, rev: 9 }))
    expect(bodyOf(callsTo(fetchMock, '/api/score')[0])).toEqual({ action: 'reset' })
    expect(screen.queryByText('Wirklich beide Teams auf 0 setzen?')).not.toBeInTheDocument()
  })

  it.each([
    ['live', 'Live verbunden'],
    ['polling', 'Verbindung wird neu aufgebaut'],
  ] as const)('tells the connection state (%s)', (status, text) => {
    setLive({ status })
    render(<ScoreRemote />)
    expect(screen.getByText(text)).toBeInTheDocument()
  })
})
