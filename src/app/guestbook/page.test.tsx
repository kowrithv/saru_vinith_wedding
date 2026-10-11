import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestbookPage from './page'

function mockFetchSequence(responses: unknown[]) {
  const fn = vi.fn()
  responses.forEach((body) => {
    fn.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('GuestbookPage', () => {
  beforeEach(() => {
    mockFetchSequence([{ entries: [] }])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and renders existing entries', async () => {
    mockFetchSequence([
      {
        entries: [
          { id: 1, name: 'Anna', message: 'Wir freuen uns so für euch!', createdAt: '2026-10-11T10:00:00.000Z' },
        ],
      },
    ])
    render(<GuestbookPage />)
    await waitFor(() => expect(screen.getByText('Wir freuen uns so für euch!')).toBeInTheDocument())
    expect(screen.getByText('Anna')).toBeInTheDocument()
  })

  it('submits a new entry and shows it in the list', async () => {
    const fetchMock = mockFetchSequence([
      { entries: [] },
      { entry: { id: 2, name: 'Ben', message: 'Alles Gute euch beiden zusammen!', createdAt: '2026-10-11T11:00:00.000Z' } },
    ])

    render(<GuestbookPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await userEvent.type(screen.getByLabelText(/Name/i), 'Ben')
    await userEvent.type(screen.getByLabelText(/Nachricht/i), 'Alles Gute euch beiden zusammen!')
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    await waitFor(() => expect(screen.getByText('Alles Gute euch beiden zusammen!')).toBeInTheDocument())
  })

  it('shows a validation message and does not submit when the message is too short', async () => {
    const fetchMock = mockFetchSequence([{ entries: [] }])
    render(<GuestbookPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await userEvent.type(screen.getByLabelText(/Name/i), 'Ben')
    await userEvent.type(screen.getByLabelText(/Nachricht/i), 'Zu kurz')
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    expect(screen.getByText(/mindestens 10 Zeichen/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('carries its own top offset below the fixed navigation', async () => {
    const { container } = render(<GuestbookPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pt-24'))
  })
})
