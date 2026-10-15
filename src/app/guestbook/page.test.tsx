import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestbookPage from './page'
import { bodyOf, callsTo, mockFetchRoutes } from '@/test-utils/mock-fetch'

const entry = { id: 2, name: 'Ben', message: 'Alles Gute euch beiden zusammen!', createdAt: '2026-10-11T11:00:00.000Z' }

async function fillForm() {
  await userEvent.type(screen.getByLabelText(/Name/i), 'Ben')
  await userEvent.type(screen.getByLabelText(/Nachricht/i), 'Alles Gute euch beiden zusammen!')
}

describe('GuestbookPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/guestbook')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('loads and renders existing entries', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/guestbook': {
        body: {
          entries: [
            { id: 1, name: 'Anna', message: 'Wir freuen uns so für euch!', createdAt: '2026-10-11T10:00:00.000Z' },
          ],
        },
      },
    })
    render(<GuestbookPage />)
    await waitFor(() => expect(screen.getByText('Wir freuen uns so für euch!')).toBeInTheDocument())
    expect(screen.getByText('Anna')).toBeInTheDocument()
  })

  it('does not ask for the password when this browser is already unlocked', async () => {
    const fetchMock = mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/guestbook': (init) =>
        init?.method === 'POST' ? { status: 201, body: { entry } } : { body: { entries: [] } },
    })
    render(<GuestbookPage />)
    await waitFor(() => expect(callsTo(fetchMock, '/api/access')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument())

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    await waitFor(() => expect(screen.getByText('Alles Gute euch beiden zusammen!')).toBeInTheDocument())
    const post = callsTo(fetchMock, '/api/guestbook').find(([, init]) => init?.method === 'POST')!
    expect(bodyOf(post)).toEqual({ name: 'Ben', message: 'Alles Gute euch beiden zusammen!' })
  })

  it('asks for the password when the browser is not unlocked and sends it with the entry', async () => {
    const fetchMock = mockFetchRoutes({
      '/api/access': { body: { unlocked: false } },
      '/api/guestbook': (init) =>
        init?.method === 'POST' ? { status: 201, body: { entry } } : { body: { entries: [] } },
    })
    render(<GuestbookPage />)
    const field = await screen.findByLabelText(/kennwort vom empfang/i)

    await fillForm()
    await userEvent.type(field, 'Hochzeit')
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    await waitFor(() => expect(screen.getByText('Alles Gute euch beiden zusammen!')).toBeInTheDocument())
    const post = callsTo(fetchMock, '/api/guestbook').find(([, init]) => init?.method === 'POST')!
    expect(bodyOf(post)).toMatchObject({ password: 'Hochzeit' })
    // Der Server hat die Sitzung gesetzt: das Feld wird nicht mehr gebraucht.
    await waitFor(() => expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument())
  })

  it('does not submit without a password while the browser is locked', async () => {
    const fetchMock = mockFetchRoutes({
      '/api/access': { body: { unlocked: false } },
      '/api/guestbook': { body: { entries: [] } },
    })
    render(<GuestbookPage />)
    await screen.findByLabelText(/kennwort vom empfang/i)

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    expect(screen.getByText(/kennwort vom empfang ein/i)).toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/guestbook').filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  })

  it('shows "Falsches Kennwort." and keeps the field when the server rejects the password', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: false } },
      '/api/guestbook': (init) =>
        init?.method === 'POST'
          ? { status: 401, body: { error: 'Falsches Kennwort.' } }
          : { body: { entries: [] } },
    })
    render(<GuestbookPage />)
    const field = await screen.findByLabelText(/kennwort vom empfang/i)

    await fillForm()
    await userEvent.type(field, 'falsch')
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    await waitFor(() => expect(screen.getByText('Falsches Kennwort.')).toBeInTheDocument())
    expect(screen.getByLabelText(/kennwort vom empfang/i)).toBeInTheDocument()
  })

  it('brings the field back when a remembered session is no longer valid', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/guestbook': (init) =>
        init?.method === 'POST'
          ? { status: 401, body: { error: 'Falsches Kennwort.' } }
          : { body: { entries: [] } },
    })
    render(<GuestbookPage />)
    await waitFor(() => expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument())

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    expect(await screen.findByLabelText(/kennwort vom empfang/i)).toBeInTheDocument()
    expect(screen.getByText(/bitte gib das kennwort vom empfang ein/i)).toBeInTheDocument()
  })

  it('unlocks from the QR link in the address and never shows the field', async () => {
    window.history.replaceState(null, '', '/guestbook#k=Hochzeit')
    const fetchMock = mockFetchRoutes({
      '/api/gallery/unlock': { body: { success: true } },
      '/api/guestbook': { body: { entries: [] } },
    })
    render(<GuestbookPage />)

    await waitFor(() => expect(callsTo(fetchMock, '/api/gallery/unlock')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, '/api/gallery/unlock')[0])).toEqual({ password: 'Hochzeit' })
    await waitFor(() => expect(window.location.hash).toBe(''))
    expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
  })

  it('shows a validation message and does not submit when the message is too short', async () => {
    const fetchMock = mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/guestbook': { body: { entries: [] } },
    })
    render(<GuestbookPage />)
    await waitFor(() => expect(callsTo(fetchMock, '/api/guestbook')).toHaveLength(1))

    await userEvent.type(screen.getByLabelText(/Name/i), 'Ben')
    await userEvent.type(screen.getByLabelText(/Nachricht/i), 'Zu kurz')
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    expect(screen.getByText(/mindestens 10 Zeichen/i)).toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/guestbook')).toHaveLength(1)
  })

  it("shows the server's own error message when posting is locked", async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/guestbook': (init) =>
        init?.method === 'POST'
          ? { status: 423, body: { error: 'Neue Einträge sind derzeit vorübergehend gesperrt.' } }
          : { body: { entries: [] } },
    })
    render(<GuestbookPage />)
    await waitFor(() => expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument())

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    await waitFor(() =>
      expect(screen.getByText('Neue Einträge sind derzeit vorübergehend gesperrt.')).toBeInTheDocument()
    )
  })

  it('prefills the name this device remembered from another form', async () => {
    window.localStorage.setItem('wedding-guest-name', 'Anna')
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/guestbook': { body: { entries: [] } },
    })
    render(<GuestbookPage />)

    await waitFor(() => expect(screen.getByLabelText(/Name/i)).toHaveValue('Anna'))
  })

  it('remembers the name on submit and keeps it in the field for the next entry', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/guestbook': (init) =>
        init?.method === 'POST' ? { status: 201, body: { entry } } : { body: { entries: [] } },
    })
    render(<GuestbookPage />)
    await waitFor(() => expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument())

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    await waitFor(() => expect(screen.getByText('Alles Gute euch beiden zusammen!', { selector: 'p' })).toBeInTheDocument())
    expect(window.localStorage.getItem('wedding-guest-name')).toBe('Ben')
    expect(screen.getByLabelText(/Name/i)).toHaveValue('Ben')
    expect(screen.getByLabelText(/Nachricht/i)).toHaveValue('')
  })

  it('carries its own top offset below the fixed navigation', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/guestbook': { body: { entries: [] } },
    })
    const { container } = render(<GuestbookPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pt-24'))
  })

  it('shows each entry as a letter card: the message first, the name as a signature, no avatar', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/guestbook': {
        body: {
          entries: [{ id: 1, name: 'Anna Schmidt', message: 'Wir freuen uns so für euch!', createdAt: '2026-10-11T10:00:00.000Z' }],
        },
      },
    })
    render(<GuestbookPage />)

    const message = await screen.findByText('Wir freuen uns so für euch!')
    expect(message).toHaveClass('font-display', 'italic')
    expect(screen.getByText('Anna Schmidt')).toHaveClass('font-script')
    // Der Name steht schon als Unterschrift da: keine Initialen-Marke daneben.
    expect(screen.queryByText('AS')).not.toBeInTheDocument()
  })

  // Wie bei einem Brief: die Unterschrift steht rechts unter dem Text.
  it('aligns the signature and the date to the right under the message', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/guestbook': {
        body: {
          entries: [{ id: 1, name: 'Anna Schmidt', message: 'Wir freuen uns so für euch!', createdAt: '2026-10-11T10:00:00.000Z' }],
        },
      },
    })
    render(<GuestbookPage />)

    await screen.findByText('Wir freuen uns so für euch!')
    const signature = screen.getByText('Anna Schmidt').parentElement as HTMLElement
    expect(signature).toHaveClass('text-right')
    expect(signature).toHaveTextContent(/11\. Okt\.? 2026/)
  })

  it('shows the newest 30 entries and the older ones on request', async () => {
    const entries = Array.from({ length: 70 }, (_, i) => ({
      id: 70 - i,
      name: `Gast ${70 - i}`,
      message: `Eine Nachricht von Gast ${70 - i}.`,
      createdAt: '2026-10-11T10:00:00.000Z',
    }))
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/guestbook': { body: { entries } },
    })
    render(<GuestbookPage />)

    await screen.findByText('Eine Nachricht von Gast 70.')
    expect(screen.getAllByText(/^Eine Nachricht von Gast/)).toHaveLength(30)
    await userEvent.click(screen.getByRole('button', { name: /30 ältere/i }))
    expect(screen.getAllByText(/^Eine Nachricht von Gast/)).toHaveLength(60)
    await userEvent.click(screen.getByRole('button', { name: /10 ältere/i }))
    expect(screen.getAllByText(/^Eine Nachricht von Gast/)).toHaveLength(70)
    expect(screen.queryByRole('button', { name: /ältere/i })).not.toBeInTheDocument()
  })
})
