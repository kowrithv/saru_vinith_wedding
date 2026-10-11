import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemoriesPage from './page'

function mockFetchSequence(responses: { status?: number; body: unknown }[]) {
  const fn = vi.fn()
  responses.forEach(({ status = 200, body }) => {
    fn.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('MemoriesPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and renders existing entries', async () => {
    mockFetchSequence([
      {
        body: {
          entries: [
            { id: 1, name: 'Anna', message: 'Ich erinnere mich an eure Verlobung.', photoKey: null, createdAt: '2026-10-11T10:00:00.000Z' },
          ],
        },
      },
    ])
    render(<MemoriesPage />)
    // Die Nachricht wird in Anführungszeichen gerendert (Zitat-Stil, wie in
    // der alten App) - exakte Übereinstimmung ohne diese Zeichen würde nie
    // treffen, daher ein Regex-Teiltreffer statt eines exakten Strings.
    await waitFor(() =>
      expect(screen.getByText(/Ich erinnere mich an eure Verlobung\./)).toBeInTheDocument()
    )
  })

  it('submits a new entry with the password and shows it in the list', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { status: 201, body: { entry: { id: 2, name: 'Ben', message: 'Ein toller gemeinsamer Abend war das.', photoKey: null, createdAt: '2026-10-11T11:00:00.000Z' } } },
    ])

    render(<MemoriesPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await userEvent.type(screen.getByLabelText(/Name/i), 'Ben')
    await userEvent.type(screen.getByLabelText(/Erinnerung/i), 'Ein toller gemeinsamer Abend war das.')
    await userEvent.type(screen.getByLabelText(/Kennwort/i), 'empfang-secret')
    await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

    await waitFor(() =>
      expect(screen.getByText(/Ein toller gemeinsamer Abend war das\./)).toBeInTheDocument()
    )
  })

  it('shows an error when the password is rejected by the server', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { status: 401, body: { error: 'Falsches Kennwort.' } },
    ])

    render(<MemoriesPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await userEvent.type(screen.getByLabelText(/Name/i), 'Ben')
    await userEvent.type(screen.getByLabelText(/Erinnerung/i), 'Ein toller gemeinsamer Abend war das.')
    await userEvent.type(screen.getByLabelText(/Kennwort/i), 'falsch')
    await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

    await waitFor(() => expect(screen.getByText(/falsches kennwort/i)).toBeInTheDocument())
  })

  it('carries its own top offset below the fixed navigation', async () => {
    mockFetchSequence([{ body: { entries: [] } }])
    const { container } = render(<MemoriesPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pt-24'))
  })
})
