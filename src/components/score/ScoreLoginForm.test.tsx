import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScoreLoginForm from './ScoreLoginForm'
import { bodyOf, callsTo, mockFetchRoutes as mockFetch } from '@/test-utils/mock-fetch'

describe('ScoreLoginForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the password and reports success', async () => {
    const fetchMock = mockFetch({ '/api/score/login': { body: { success: true } } })
    const onSuccess = vi.fn()
    render(<ScoreLoginForm title="Beamer" onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText('Passwort'), 'Torte')
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(bodyOf(callsTo(fetchMock, '/api/score/login')[0])).toEqual({ password: 'Torte' })
  })

  it('shows the server message for a wrong password and stays', async () => {
    mockFetch({ '/api/score/login': { status: 401, body: { error: 'Falsches Passwort.' } } })
    const onSuccess = vi.fn()
    render(<ScoreLoginForm title="Beamer" onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText('Passwort'), 'Kuchen')
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByText('Falsches Passwort.')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('tells when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<ScoreLoginForm title="Beamer" onSuccess={() => {}} />)

    await userEvent.type(screen.getByLabelText('Passwort'), 'Torte')
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByText('Keine Verbindung. Bitte noch einmal versuchen.')).toBeInTheDocument()
  })

  it('shows the title and keeps the button off while the field is empty', () => {
    render(<ScoreLoginForm title="Punktestand steuern" onSuccess={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Punktestand steuern' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeDisabled()
  })
})
