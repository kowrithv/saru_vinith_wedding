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

describe('AdminDashboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and shows guestbook and memories entries', async () => {
    mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [{ id: 5, name: 'Ben', message: 'Schöne Erinnerung an euch.', photoKey: null, createdAt: '2026-10-11T11:00:00.000Z' }] } },
    ])

    render(<AdminDashboard initialLocked={false} />)

    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())
    expect(screen.getByText(/Schöne Erinnerung an euch\./)).toBeInTheDocument()
  })

  it('removes an entry from the list only after the server confirms deletion', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [] } },
      { status: 200, body: { success: true } },
    ])

    render(<AdminDashboard initialLocked={false} />)
    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*Anna/i }))

    await waitFor(() => expect(screen.queryByText('Herzlichen Glückwunsch euch!')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/guestbook/1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('does not remove the entry if the server delete fails', async () => {
    mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [] } },
      { status: 500, body: { error: 'Serverfehler' } },
    ])

    render(<AdminDashboard initialLocked={false} />)
    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*Anna/i }))

    await waitFor(() => expect(screen.getByText(/löschen fehlgeschlagen/i)).toBeInTheDocument())
    expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument()
  })

  it('shows an error and leaves the lock unchanged when toggling fails', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { status: 500, body: { error: 'Serverfehler' } },
    ])

    render(<AdminDashboard initialLocked={false} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const toggle = screen.getByRole('switch', { name: /schreib-sperre/i })
    await userEvent.click(toggle)

    await waitFor(() => expect(screen.getByText(/umschalten fehlgeschlagen/i)).toBeInTheDocument())
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles the write lock and persists it to the server', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { body: { locked: true } },
    ])

    render(<AdminDashboard initialLocked={false} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    await userEvent.click(screen.getByRole('switch', { name: /schreib-sperre/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/write-lock',
        expect.objectContaining({ method: 'POST' })
      )
    )
  })
})
