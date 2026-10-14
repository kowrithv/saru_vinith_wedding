import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemoriesPage from './page'
import { bodyOf, callsTo, mockFetchRoutes } from '@/test-utils/mock-fetch'

const newEntry = {
  id: 2,
  name: 'Ben',
  message: 'Ein toller gemeinsamer Abend war das.',
  photoKey: null,
  createdAt: '2026-10-11T11:00:00.000Z',
}

async function fillForm() {
  await userEvent.type(screen.getByLabelText(/Dein Name/i), 'Ben')
  await userEvent.type(screen.getByLabelText(/Deine Erinnerung/i), 'Ein toller gemeinsamer Abend war das.')
}

describe('MemoriesPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/memories')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('loads and renders existing entries', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/memories': {
        body: {
          entries: [
            { id: 1, name: 'Anna', message: 'Ich erinnere mich an eure Verlobung.', photoKey: null, createdAt: '2026-10-11T10:00:00.000Z' },
          ],
        },
      },
    })
    render(<MemoriesPage />)
    // Die Nachricht wird in Anführungszeichen gerendert (Zitat-Stil, wie in
    // der alten App) - exakte Übereinstimmung ohne diese Zeichen würde nie
    // treffen, daher ein Regex-Teiltreffer statt eines exakten Strings.
    await waitFor(() =>
      expect(screen.getByText(/Ich erinnere mich an eure Verlobung\./)).toBeInTheDocument()
    )
  })

  it('does not ask for the password when this browser is already unlocked', async () => {
    const fetchMock = mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/memories': (init) =>
        init?.method === 'POST' ? { status: 201, body: { entry: newEntry } } : { body: { entries: [] } },
    })
    render(<MemoriesPage />)
    await waitFor(() => expect(callsTo(fetchMock, '/api/access')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument())

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

    await waitFor(() =>
      expect(screen.getByText(/Ein toller gemeinsamer Abend war das\./)).toBeInTheDocument()
    )
    const post = callsTo(fetchMock, '/api/memories').find(([, init]) => init?.method === 'POST')!
    expect(bodyOf(post)).toEqual({ name: 'Ben', message: 'Ein toller gemeinsamer Abend war das.' })
  })

  it('submits a new entry with the password when the browser is not unlocked yet', async () => {
    const fetchMock = mockFetchRoutes({
      '/api/access': { body: { unlocked: false } },
      '/api/memories': (init) =>
        init?.method === 'POST' ? { status: 201, body: { entry: newEntry } } : { body: { entries: [] } },
    })
    render(<MemoriesPage />)
    const field = await screen.findByLabelText(/Kennwort/i)

    await fillForm()
    await userEvent.type(field, 'empfang-secret')
    await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

    await waitFor(() =>
      expect(screen.getByText(/Ein toller gemeinsamer Abend war das\./)).toBeInTheDocument()
    )
    const post = callsTo(fetchMock, '/api/memories').find(([, init]) => init?.method === 'POST')!
    expect(bodyOf(post)).toMatchObject({ password: 'empfang-secret' })
    await waitFor(() => expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument())
  })

  it('does not submit without a password while the browser is locked', async () => {
    const fetchMock = mockFetchRoutes({
      '/api/access': { body: { unlocked: false } },
      '/api/memories': { body: { entries: [] } },
    })
    render(<MemoriesPage />)
    await screen.findByLabelText(/Kennwort/i)

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

    expect(screen.getByText(/kennwort vom empfang ein/i)).toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/memories').filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  })

  it('shows an error when the password is rejected by the server', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: false } },
      '/api/memories': (init) =>
        init?.method === 'POST'
          ? { status: 401, body: { error: 'Falsches Kennwort.' } }
          : { body: { entries: [] } },
    })
    render(<MemoriesPage />)
    const field = await screen.findByLabelText(/Kennwort/i)

    await fillForm()
    await userEvent.type(field, 'falsch')
    await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

    await waitFor(() => expect(screen.getByText(/falsches kennwort/i)).toBeInTheDocument())
    expect(screen.getByLabelText(/Kennwort/i)).toBeInTheDocument()
  })

  it('brings the field back when a remembered session is no longer valid', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/memories': (init) =>
        init?.method === 'POST'
          ? { status: 401, body: { error: 'Falsches Kennwort.' } }
          : { body: { entries: [] } },
    })
    render(<MemoriesPage />)
    await waitFor(() => expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument())

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

    expect(await screen.findByLabelText(/Kennwort/i)).toBeInTheDocument()
    expect(screen.getByText(/bitte gib das kennwort vom empfang ein/i)).toBeInTheDocument()
  })

  it('unlocks from the QR link in the address', async () => {
    window.history.replaceState(null, '', '/memories#k=Hochzeit')
    const fetchMock = mockFetchRoutes({
      '/api/gallery/unlock': { body: { success: true } },
      '/api/memories': { body: { entries: [] } },
    })
    render(<MemoriesPage />)

    await waitFor(() => expect(callsTo(fetchMock, '/api/gallery/unlock')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, '/api/gallery/unlock')[0])).toEqual({ password: 'Hochzeit' })
    await waitFor(() => expect(window.location.hash).toBe(''))
    expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
  })

  it("shows the server's own error message when posting is locked", async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/memories': (init) =>
        init?.method === 'POST'
          ? { status: 423, body: { error: 'Neue Einträge sind derzeit vorübergehend gesperrt.' } }
          : { body: { entries: [] } },
    })
    render(<MemoriesPage />)
    await waitFor(() => expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument())

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

    await waitFor(() =>
      expect(screen.getByText('Neue Einträge sind derzeit vorübergehend gesperrt.')).toBeInTheDocument()
    )
  })

  it('prefills the name this device remembered from another form', async () => {
    window.localStorage.setItem('wedding-guest-name', 'Anna')
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/memories': { body: { entries: [] } },
    })
    render(<MemoriesPage />)

    await waitFor(() => expect(screen.getByLabelText(/Dein Name/i)).toHaveValue('Anna'))
  })

  it('remembers the name on submit and keeps it in the field for the next entry', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/memories': (init) =>
        init?.method === 'POST' ? { status: 201, body: { entry: newEntry } } : { body: { entries: [] } },
    })
    render(<MemoriesPage />)
    await waitFor(() => expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument())

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

    await waitFor(() =>
      expect(screen.getByText(/Ein toller gemeinsamer Abend war das\./)).toBeInTheDocument()
    )
    expect(window.localStorage.getItem('wedding-guest-name')).toBe('Ben')
    expect(screen.getByLabelText(/Dein Name/i)).toHaveValue('Ben')
    expect(screen.getByLabelText(/Deine Erinnerung/i)).toHaveValue('')
  })

  it('carries its own top offset below the fixed navigation', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/memories': { body: { entries: [] } },
    })
    const { container } = render(<MemoriesPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pt-24'))
  })
})
