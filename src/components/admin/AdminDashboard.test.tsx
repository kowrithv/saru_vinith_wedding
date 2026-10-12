import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminDashboard from './AdminDashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function mockFetchSequence(responses: { status?: number; body: unknown }[]) {
  const fn = vi.fn()
  responses.forEach(({ status = 200, body }) => {
    fn.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const noLocks = { guestbook: false, memories: false, who_votes: false }

describe('AdminDashboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and shows guestbook and memories entries', async () => {
    mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [{ id: 5, name: 'Ben', message: 'Schöne Erinnerung an euch.', photoKey: null, createdAt: '2026-10-11T11:00:00.000Z' }] } },
    ])

    render(<AdminDashboard initialLocks={noLocks} />)

    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())
    expect(screen.getByText(/Schöne Erinnerung an euch\./)).toBeInTheDocument()
  })

  it('shows three independent switches, all unlocked by default', async () => {
    const fetchMock = mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }])
    render(<AdminDashboard initialLocks={noLocks} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: /erinnerungen/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: /wer-von-uns/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggling one feature does not change the display of the other two', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { body: { locks: { guestbook: true, memories: false, who_votes: false } } },
    ])
    render(<AdminDashboard initialLocks={noLocks} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    await userEvent.click(screen.getByRole('switch', { name: /gästebuch/i }))

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'true')
    )
    expect(screen.getByRole('switch', { name: /erinnerungen/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: /wer-von-uns/i })).toHaveAttribute('aria-checked', 'false')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/write-lock',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ feature: 'guestbook', locked: true }) })
    )
  })

  it('removes an entry from the list only after the server confirms deletion', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [] } },
      { status: 200, body: { success: true } },
    ])

    render(<AdminDashboard initialLocks={noLocks} />)
    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*Anna/i }))

    await waitFor(() => expect(screen.queryByText('Herzlichen Glückwunsch euch!')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/guestbook/1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('does not remove the entry if the server delete fails', async () => {
    mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [] } },
      { status: 500, body: { error: 'Serverfehler' } },
    ])

    render(<AdminDashboard initialLocks={noLocks} />)
    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*Anna/i }))

    await waitFor(() => expect(screen.getByText(/löschen fehlgeschlagen/i)).toBeInTheDocument())
    expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument()
  })

  it('shows an error and leaves the switches unchanged when toggling fails', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { status: 500, body: { error: 'Serverfehler' } },
    ])

    render(<AdminDashboard initialLocks={noLocks} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const toggle = screen.getByRole('switch', { name: /gästebuch/i })
    await userEvent.click(toggle)

    await waitFor(() => expect(screen.getByText(/umschalten fehlgeschlagen/i)).toBeInTheDocument())
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})
