import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemoriesPage from './page'
import { bodyOf, callsTo, mockFetchRoutes } from '@/test-utils/mock-fetch'
import { uploadPhotoForTicket } from '@/lib/photo-upload'
import { getDeleteToken } from '@/lib/gallery-delete-tokens'

vi.mock('@/lib/photo-upload', () => ({ uploadPhotoForTicket: vi.fn() }))

const photoView = {
  id: 'photo-1',
  thumbUrl: 'https://fotos.example.de/gallery/photo-1/thumb.jpg',
  originalUrl: 'https://fotos.example.de/gallery/photo-1/original.jpg',
}

function photoFile(name = 'foto.jpg', type = 'image/jpeg', size = 100) {
  return new File(['x'.repeat(size)], name, { type })
}

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
    vi.mocked(uploadPhotoForTicket).mockReset()
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
        init?.method === 'POST' ? { status: 201, body: { entry: newEntry } } : { body: { entries: [], photosEnabled: true } },
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
        init?.method === 'POST' ? { status: 201, body: { entry: newEntry } } : { body: { entries: [], photosEnabled: true } },
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

  it('says next to the photo field that only photos work, no videos', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/memories': { body: { entries: [], photosEnabled: true } },
    })
    render(<MemoriesPage />)
    expect(await screen.findByText(/nur fotos, keine videos/i)).toBeInTheDocument()
  })

  it('does not submit without a password while the browser is locked', async () => {
    const fetchMock = mockFetchRoutes({
      '/api/access': { body: { unlocked: false } },
      '/api/memories': { body: { entries: [], photosEnabled: true } },
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
          : { body: { entries: [], photosEnabled: true } },
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
          : { body: { entries: [], photosEnabled: true } },
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
      '/api/memories': { body: { entries: [], photosEnabled: true } },
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
          : { body: { entries: [], photosEnabled: true } },
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
      '/api/memories': { body: { entries: [], photosEnabled: true } },
    })
    render(<MemoriesPage />)

    await waitFor(() => expect(screen.getByLabelText(/Dein Name/i)).toHaveValue('Anna'))
  })

  it('remembers the name on submit and keeps it in the field for the next entry', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/memories': (init) =>
        init?.method === 'POST' ? { status: 201, body: { entry: newEntry } } : { body: { entries: [], photosEnabled: true } },
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
      '/api/memories': { body: { entries: [], photosEnabled: true } },
    })
    const { container } = render(<MemoriesPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pt-24'))
  })

  describe('with a photo', () => {
    function mockApi(options: { photosEnabled?: boolean; access?: boolean; entries?: unknown[] } = {}) {
      const { photosEnabled = true, access = true, entries = [] } = options
      return mockFetchRoutes({
        '/api/access': { body: { unlocked: access } },
        '/api/memories': (init) =>
          init?.method === 'POST'
            ? { status: 201, body: { entry: { ...newEntry, hasPhoto: true, photo: photoView }, deleteToken: 'tok-1' } }
            : { body: { entries, photosEnabled } },
      })
    }

    it('offers the optional photo field while memory photos are enabled', async () => {
      mockApi()
      render(<MemoriesPage />)
      expect(await screen.findByLabelText(/foto \(optional\)/i)).toBeInTheDocument()
    })

    it('hides the photo field while memory photos are locked', async () => {
      const fetchMock = mockApi({ photosEnabled: false })
      render(<MemoriesPage />)
      await waitFor(() => expect(callsTo(fetchMock, '/api/memories')).toHaveLength(1))
      await waitFor(() => expect(screen.getByLabelText(/Dein Name/i)).toBeInTheDocument())

      expect(screen.queryByLabelText(/foto \(optional\)/i)).not.toBeInTheDocument()
    })

    it('uploads the photo first and sends the ticket with the entry', async () => {
      vi.mocked(uploadPhotoForTicket).mockResolvedValue({ ok: true, ticket: 'T-1' })
      const fetchMock = mockApi()
      render(<MemoriesPage />)
      const input = await screen.findByLabelText(/foto \(optional\)/i)

      await fillForm()
      await userEvent.upload(input, photoFile())
      await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

      await waitFor(() => expect(screen.getByAltText(/foto von ben/i)).toBeInTheDocument())
      expect(uploadPhotoForTicket).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'image/jpeg', category: 'Erinnerungen' })
      )
      const post = callsTo(fetchMock, '/api/memories').find(([, init]) => init?.method === 'POST')!
      expect(bodyOf(post)).toMatchObject({ name: 'Ben', ticket: 'T-1' })
      // Das Lösch-Token des Galerie-Fotos bleibt auf diesem Gerät.
      expect(getDeleteToken('photo-1')).toBe('tok-1')
    })

    it('sends no ticket and does not upload for a text-only entry', async () => {
      const fetchMock = mockApi()
      render(<MemoriesPage />)
      await screen.findByLabelText(/foto \(optional\)/i)

      await fillForm()
      await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

      await waitFor(() => expect(screen.getByText(/Ein toller gemeinsamer Abend war das\./)).toBeInTheDocument())
      expect(uploadPhotoForTicket).not.toHaveBeenCalled()
      const post = callsTo(fetchMock, '/api/memories').find(([, init]) => init?.method === 'POST')!
      expect(bodyOf(post)).not.toHaveProperty('ticket')
    })

    it('passes the typed password to the photo upload while the browser is locked', async () => {
      vi.mocked(uploadPhotoForTicket).mockResolvedValue({ ok: true, ticket: 'T-1' })
      mockApi({ access: false })
      render(<MemoriesPage />)
      const passwordField = await screen.findByLabelText(/kennwort vom empfang/i)

      await fillForm()
      await userEvent.type(passwordField, 'empfang-secret')
      await userEvent.upload(await screen.findByLabelText(/foto \(optional\)/i), photoFile())
      await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

      await waitFor(() => expect(uploadPhotoForTicket).toHaveBeenCalled())
      expect(vi.mocked(uploadPhotoForTicket).mock.calls[0][0]).toMatchObject({ password: 'empfang-secret' })
    })

    it('shows the upload error and saves no entry when the photo cannot be uploaded', async () => {
      vi.mocked(uploadPhotoForTicket).mockResolvedValue({ ok: false, error: 'Übertragung fehlgeschlagen.' })
      const fetchMock = mockApi()
      render(<MemoriesPage />)
      const input = await screen.findByLabelText(/foto \(optional\)/i)

      await fillForm()
      await userEvent.upload(input, photoFile())
      await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

      await waitFor(() => expect(screen.getByText('Übertragung fehlgeschlagen.')).toBeInTheDocument())
      const posts = callsTo(fetchMock, '/api/memories').filter(([, init]) => init?.method === 'POST')
      expect(posts).toHaveLength(0)
      // Der Text bleibt stehen, damit nichts neu getippt werden muss.
      expect(screen.getByLabelText(/Deine Erinnerung/i)).toHaveValue('Ein toller gemeinsamer Abend war das.')
    })

    it('asks for the password again when the photo upload says the session is gone', async () => {
      vi.mocked(uploadPhotoForTicket).mockResolvedValue({ ok: false, error: 'Falsches Kennwort.', unauthorized: true })
      mockApi({ access: true })
      render(<MemoriesPage />)
      const input = await screen.findByLabelText(/foto \(optional\)/i)
      await waitFor(() => expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument())

      await fillForm()
      await userEvent.upload(input, photoFile())
      await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

      expect(await screen.findByLabelText(/kennwort vom empfang/i)).toBeInTheDocument()
    })

    it('rejects a file that is not an image or is larger than 20 MB before uploading', async () => {
      mockApi()
      render(<MemoriesPage />)
      const input = await screen.findByLabelText(/foto \(optional\)/i)

      await userEvent.upload(input, photoFile('dokument.pdf', 'application/pdf'), { applyAccept: false })
      expect(screen.getByText(/dateityp/i)).toBeInTheDocument()

      await userEvent.upload(input, photoFile('gross.jpg', 'image/jpeg', 21 * 1024 * 1024))
      expect(screen.getByText(/max\. 20 mb/i)).toBeInTheDocument()
      expect(uploadPhotoForTicket).not.toHaveBeenCalled()
    })

    it('shows an entry photo as an image that opens the original', async () => {
      mockApi({
        entries: [{ ...newEntry, id: 7, hasPhoto: true, photo: photoView }],
      })
      render(<MemoriesPage />)

      const image = await screen.findByAltText(/foto von ben/i)
      expect(image).toHaveAttribute('src', photoView.thumbUrl)
      expect(image.closest('a')).toHaveAttribute('href', photoView.originalUrl)
    })

    it('tells a locked browser that there is a photo it will see after unlocking', async () => {
      mockApi({
        access: false,
        entries: [{ ...newEntry, id: 7, hasPhoto: true, photo: null }],
      })
      render(<MemoriesPage />)

      expect(await screen.findByText(/foto.*nach dem entsperren/i)).toBeInTheDocument()
      expect(screen.queryByAltText(/foto von/i)).not.toBeInTheDocument()
    })
  })

  it('shows the German time next to the date of each entry', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/memories': {
        body: {
          entries: [
            { id: 1, name: 'Anna', message: 'Ich erinnere mich an eure Verlobung.', hasPhoto: false, photo: null, createdAt: '2026-10-17T19:14:00.000Z' },
          ],
          photosEnabled: true,
        },
      },
    })
    render(<MemoriesPage />)

    expect(await screen.findByText('17. Okt. 2026 · 21:14 Uhr')).toBeInTheDocument()
  })

  it('has no round avatar next to the name of a text entry', async () => {
    mockFetchRoutes({
      '/api/access': { body: { unlocked: true } },
      '/api/memories': {
        body: {
          entries: [
            { id: 1, name: 'Anna', message: 'Ich erinnere mich an eure Verlobung.', hasPhoto: false, photo: null, createdAt: '2026-10-17T19:14:00.000Z' },
          ],
          photosEnabled: true,
        },
      },
    })
    render(<MemoriesPage />)

    const card = (await screen.findByText(/Ich erinnere mich an eure Verlobung/)).closest('.card-ornate')
    expect(card).not.toBeNull()
    expect(card?.querySelector('svg')).toBeNull()
  })
})
