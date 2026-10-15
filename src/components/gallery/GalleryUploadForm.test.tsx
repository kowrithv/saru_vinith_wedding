import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GalleryUploadForm from './GalleryUploadForm'
import { getDeleteToken } from '@/lib/gallery-delete-tokens'
import { createPlaceholderThumbnailBlob, createThumbnailBlob } from '@/lib/gallery-thumbnail'

vi.mock('@/lib/gallery-thumbnail', () => ({
  createThumbnailBlob: vi.fn(),
  createPlaceholderThumbnailBlob: vi.fn(),
}))

function makeFile(name = 'photo.jpg', type = 'image/jpeg'): File {
  return new File(['x'.repeat(100)], name, { type })
}

interface FakeBackendOptions {
  /** Dateinamen, deren /complete-Aufruf mit einem Fehler antwortet (darf nachträglich geändert werden). */
  failComplete?: Set<string>
  /** R2-URLs, deren PUT mit HTTP 403 antwortet. */
  failPutUrls?: Set<string>
  /** Hält /complete an, bis das Promise aufgelöst wird. */
  holdComplete?: Promise<void>
  /** R2-PUTs antworten nie - außer das Abbruch-Signal der Anfrage löst aus. */
  hangPuts?: boolean
  /** R2-PUTs brauchen so viele Millisekunden (Fake-Timer). */
  putDelayMs?: number
  /** Fehlertext, den /complete bei failComplete liefert. */
  completeError?: string
}

// Minimaler Server: vergibt je Datei ein Ticket, erkennt R2-PUTs und beantwortet
// /complete. `events` hält die Reihenfolge der Server-Aufrufe fest.
function createFakeBackend(options: FakeBackendOptions = {}) {
  const events: string[] = []
  const requestBodies: {
    files: { filename: string; size: number; contentType: string; thumbSize: number }[]
    [key: string]: unknown
  }[] = []
  const filenameByTicket = new Map<string, string>()
  let counter = 0

  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === '/api/uploads/request') {
      const body = JSON.parse(init?.body as string) as (typeof requestBodies)[number]
      events.push('request')
      requestBodies.push(body)
      const tickets = body.files.map((file) => {
        counter += 1
        const ticket = `ticket-${counter}`
        filenameByTicket.set(ticket, file.filename)
        return {
          photoId: `p${counter}`,
          thumbPutUrl: `https://r2.example/thumb${counter}`,
          originalPutUrl: `https://r2.example/original${counter}`,
          ticket,
        }
      })
      return { ok: true, json: async () => ({ tickets }) }
    }
    if (url === '/api/uploads/complete') {
      const { ticket } = JSON.parse(init?.body as string) as { ticket: string }
      events.push('complete')
      if (options.holdComplete) {
        // Wie ein echtes fetch: ein abgebrochenes Signal beendet die Anfrage
        // sofort - der Server hat sie da aber längst angenommen.
        const hold = options.holdComplete
        await new Promise<void>((resolve, reject) => {
          void hold.then(resolve)
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
      }
      const filename = filenameByTicket.get(ticket) as string
      if (options.failComplete?.has(filename)) {
        return { ok: false, json: async () => ({ error: options.completeError ?? `Fehler bei ${filename}` }) }
      }
      const id = ticket.replace('ticket-', 'p')
      return {
        ok: true,
        json: async () => ({
          photo: {
            id,
            uploaderName: 'Anna',
            category: 'Standesamt',
            isOfficial: false,
            createdAt: '2026-10-12T10:00:00.000Z',
            thumbUrl: `https://fotos.example.de/${id}/thumb.jpg`,
            originalUrl: `https://fotos.example.de/${id}/original.jpg`,
          },
          deleteToken: `token-${id}`,
        }),
      }
    }
    if (url.startsWith('https://r2.example/')) {
      if (options.hangPuts) {
        return new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
      }
      if (options.putDelayMs) await new Promise((resolve) => setTimeout(resolve, options.putDelayMs))
      const ok = !options.failPutUrls?.has(url)
      return { ok, status: ok ? 200 : 403 }
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, events, requestBodies }
}

function setupUser() {
  // `accept="image/*"` würde user-event sonst Dateien ohne Bildtyp (z. B. HEIC
  // ohne MIME-Typ) stillschweigend verwerfen - auf echten Geräten wählt der
  // Nutzer sie trotzdem aus.
  return userEvent.setup({ applyAccept: false })
}

describe('GalleryUploadForm', () => {
  let objectUrlCounter = 0
  const revokedUrls: string[] = []

  beforeEach(() => {
    objectUrlCounter = 0
    revokedUrls.length = 0
    URL.createObjectURL = vi.fn(() => `blob:preview-${++objectUrlCounter}`)
    URL.revokeObjectURL = vi.fn((url: string) => {
      revokedUrls.push(url)
    })
    vi.mocked(createThumbnailBlob).mockReset().mockResolvedValue(new Blob(['thumb']))
    vi.mocked(createPlaceholderThumbnailBlob).mockReset().mockResolvedValue(new Blob(['placeholder']))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('shows a password field for a guest, but not for an admin', () => {
    const { rerender } = render(<GalleryUploadForm onUploaded={vi.fn()} />)
    expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument()

    rerender(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
  })

  it('preselects the wedding category instead of the first one in the list', () => {
    render(<GalleryUploadForm onUploaded={vi.fn()} />)
    expect(screen.getByLabelText(/kategorie/i)).toHaveValue('Standesamt')
  })

  // Kennenlernen und Verlobung sind die Fotos des Brautpaars, Erinnerungen
  // entsteht über das Erinnerungs-Formular: Gäste wählen nur Hochzeit oder Party.
  it('offers guests only the wedding day and the party as categories', () => {
    render(<GalleryUploadForm onUploaded={vi.fn()} />)
    const options = within(screen.getByLabelText(/kategorie/i)).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Standesamt', 'Party'])
  })

  it('offers the couple the story categories as well, but never the memory category', () => {
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    const options = within(screen.getByLabelText(/kategorie/i)).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Kennenlernen', 'Verlobung', 'Standesamt', 'Party'])
  })

  // Videos werden nicht angenommen: das steht vor der Auswahl da, nicht erst
  // in einer Fehlermeldung danach.
  it('says before the choice that only photos work, no videos', () => {
    render(<GalleryUploadForm onUploaded={vi.fn()} />)
    expect(screen.getByText(/nur fotos, keine videos/i)).toBeInTheDocument()
  })

  it('requires a name before submitting and announces the problem', async () => {
    const user = setupUser()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)

    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/bitte gib deinen namen ein/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires a password for a guest upload', async () => {
    const user = setupUser()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<GalleryUploadForm onUploaded={vi.fn()} />)

    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(screen.getByText(/bitte gib das kennwort vom empfang ein/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uploads a file end to end for a guest and sends the chosen category and password', async () => {
    const user = setupUser()
    const backend = createFakeBackend()
    const onUploaded = vi.fn()

    render(<GalleryUploadForm onUploaded={onUploaded} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.type(screen.getByLabelText(/kennwort/i), 'empfang-secret')
    await user.selectOptions(screen.getByLabelText(/kategorie/i), 'Party')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' })))
    expect(backend.requestBodies[0]).toEqual({
      password: 'empfang-secret',
      category: 'Party',
      files: [{ filename: 'photo.jpg', size: 100, contentType: 'image/jpeg', thumbSize: 5 }],
    })
  })

  it('offers the file choice as a large, hard to miss button', () => {
    render(<GalleryUploadForm hasAccess onUploaded={vi.fn()} />)

    const input = screen.getByLabelText(/fotos ausw/i)
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('multiple')
    const button = screen.getByText('Fotos auswählen').closest('label')
    expect(button).toHaveClass('border-dashed', 'cursor-pointer')
    expect(screen.getByText('mehrere möglich')).toBeInTheDocument()
  })

  it('tells the gallery when an upload starts and when it is over', async () => {
    const user = setupUser()
    createFakeBackend()
    const onBusyChange = vi.fn()
    render(<GalleryUploadForm hasAccess onUploaded={vi.fn()} onBusyChange={onBusyChange} />)
    expect(onBusyChange).toHaveBeenLastCalledWith(false)

    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(onBusyChange).toHaveBeenCalledWith(true)
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false))
    const calls = onBusyChange.mock.calls.map(([busy]) => busy)
    expect(calls.indexOf(true)).toBeLessThan(calls.lastIndexOf(false))
  })

  describe('progress you can see', () => {
    it('shows a large tile per photo and a progress bar with the count while sending', async () => {
      const user = setupUser()
      let release: () => void = () => {}
      createFakeBackend({ holdComplete: new Promise<void>((resolve) => (release = resolve)) })
      render(<GalleryUploadForm hasAccess onUploaded={vi.fn()} />)
      await user.type(screen.getByLabelText(/dein name/i), 'Anna')
      await user.upload(screen.getByLabelText(/fotos ausw/i), [makeFile('a.jpg'), makeFile('b.jpg')])
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /hochladen/i }))

      const bar = await screen.findByRole('progressbar', { name: 'Fortschritt' })
      expect(bar).toHaveAttribute('aria-valuemax', '2')
      expect(bar).toHaveAttribute('aria-valuenow', '0')
      expect(screen.getByText('0 von 2 fertig')).toBeInTheDocument()
      expect(screen.getAllByText('Sendet …').length).toBeGreaterThan(0)
      expect(screen.getAllByRole('listitem')).toHaveLength(2)

      release()
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/2 fotos hochgeladen/i))
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('confirms a finished upload in large green type', async () => {
      const user = setupUser()
      createFakeBackend()
      render(<GalleryUploadForm hasAccess onUploaded={vi.fn()} />)
      await user.type(screen.getByLabelText(/dein name/i), 'Anna')
      await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
      await user.click(screen.getByRole('button', { name: /hochladen/i }))

      const status = await screen.findByText(/1 foto hochgeladen – danke/i)
      expect(status).toHaveClass('text-base', 'font-semibold', 'text-green-700')
    })

    it('does not count files that cannot be uploaded towards the progress', async () => {
      const user = setupUser()
      createFakeBackend({ holdComplete: new Promise<void>(() => {}) })
      render(<GalleryUploadForm hasAccess onUploaded={vi.fn()} />)
      await user.type(screen.getByLabelText(/dein name/i), 'Anna')
      await user.upload(screen.getByLabelText(/fotos ausw/i), [makeFile('gut.jpg'), makeFile('doc.pdf', 'application/pdf')])
      await user.click(screen.getByRole('button', { name: /hochladen/i }))

      expect(await screen.findByText('0 von 1 fertig')).toBeInTheDocument()
    })
  })

  it('prefills the name this device remembered from another form', () => {
    window.localStorage.setItem('wedding-guest-name', 'Anna')
    render(<GalleryUploadForm hasAccess onUploaded={vi.fn()} />)
    expect(screen.getByLabelText(/dein name/i)).toHaveValue('Anna')
  })

  it('remembers the name when the upload starts and uses it for the photos', async () => {
    const user = setupUser()
    const onUploaded = vi.fn()
    createFakeBackend()

    render(<GalleryUploadForm hasAccess onUploaded={onUploaded} />)
    await user.type(screen.getByLabelText(/dein name/i), ' Lena ')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalled())
    expect(window.localStorage.getItem('wedding-guest-name')).toBe('Lena')
  })

  // Die Länge der Vorschau wird im Ticket mitsigniert, also muss sie vor der
  // Ticket-Anfrage feststehen.
  it('creates the preview before asking for tickets and announces its size', async () => {
    const user = setupUser()
    const backend = createFakeBackend()
    vi.mocked(createThumbnailBlob).mockImplementation(async () => {
      backend.events.push('preview')
      return new Blob(['x'.repeat(1234)])
    })

    render(<GalleryUploadForm hasAccess onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(backend.events).toContain('complete'))
    expect(backend.events.slice(0, 2)).toEqual(['preview', 'request'])
    expect(backend.requestBodies[0].files[0].thumbSize).toBe(1234)
  })

  it('uses the neutral placeholder when the preview would exceed the size limit', async () => {
    const user = setupUser()
    const backend = createFakeBackend()
    vi.mocked(createThumbnailBlob).mockResolvedValue(new Blob(['x'.repeat(2 * 1024 * 1024 + 1)]))
    vi.mocked(createPlaceholderThumbnailBlob).mockResolvedValue(new Blob(['placeholder']))

    render(<GalleryUploadForm hasAccess onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(backend.requestBodies).toHaveLength(1))
    expect(createPlaceholderThumbnailBlob).toHaveBeenCalled()
    expect(backend.requestBodies[0].files[0].thumbSize).toBe('placeholder'.length)
  })

  it('hides the password field and sends no password once the browser is unlocked', async () => {
    const user = setupUser()
    const backend = createFakeBackend()

    render(<GalleryUploadForm hasAccess onUploaded={vi.fn()} />)
    expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(backend.requestBodies).toHaveLength(1))
    expect(backend.requestBodies[0]).toEqual({
      category: 'Standesamt',
      files: [{ filename: 'photo.jpg', size: 100, contentType: 'image/jpeg', thumbSize: 5 }],
    })
  })

  it('tells the parent the browser is unlocked after tickets were issued for a typed password', async () => {
    const user = setupUser()
    createFakeBackend()
    const onAccessGranted = vi.fn()

    render(<GalleryUploadForm onAccessGranted={onAccessGranted} onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.type(screen.getByLabelText(/kennwort/i), 'empfang-secret')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onAccessGranted).toHaveBeenCalledTimes(1))
  })

  it('does not report access as granted when the password was wrong', async () => {
    const user = setupUser()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Falsches Kennwort.' }) })
    )
    const onAccessGranted = vi.fn()
    const onAccessLost = vi.fn()

    render(<GalleryUploadForm onAccessGranted={onAccessGranted} onAccessLost={onAccessLost} onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.type(screen.getByLabelText(/kennwort/i), 'falsch')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/falsches kennwort/i)
    expect(onAccessGranted).not.toHaveBeenCalled()
    expect(onAccessLost).not.toHaveBeenCalled()
  })

  it('asks for the password again when a remembered session is no longer valid', async () => {
    const user = setupUser()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Falsches Kennwort.' }) })
    )
    const onAccessLost = vi.fn()

    render(<GalleryUploadForm hasAccess onAccessLost={onAccessLost} onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/bitte gib das kennwort vom empfang ein/i)
    expect(onAccessLost).toHaveBeenCalledTimes(1)
  })

  it('has saved the delete token by the time the parent is told about the new photo', async () => {
    const user = setupUser()
    createFakeBackend()
    let tokenSeenByParent: string | undefined
    // Der Wert wird hier erfasst statt per expect geprüft: ein expect, das im
    // Callback wirft, würde vom try/catch der Komponente verschluckt.
    const onUploaded = vi.fn((photo: { id: string }) => {
      tokenSeenByParent = getDeleteToken(photo.id)
    })

    render(<GalleryUploadForm isAdmin onUploaded={onUploaded} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalled())
    expect(tokenSeenByParent).toBe('token-p1')
  })

  it('uploads without a password field when used as an admin', async () => {
    const user = setupUser()
    const backend = createFakeBackend()

    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Saruga')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(backend.requestBodies).toHaveLength(1))
    expect(backend.requestBodies[0]).toEqual({
      category: 'Standesamt',
      files: [{ filename: 'photo.jpg', size: 100, contentType: 'image/jpeg', thumbSize: 5 }],
    })
  })

  it('marks only the failing file as an error, shows the server message, and keeps the others', async () => {
    const user = setupUser()
    createFakeBackend({ failComplete: new Set(['b.jpg']) })
    const onUploaded = vi.fn()

    render(<GalleryUploadForm isAdmin onUploaded={onUploaded} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), [makeFile('a.jpg'), makeFile('b.jpg')])
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1))
    expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
    expect(await screen.findByText('Fehler bei b.jpg')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/1 foto hochgeladen/i)
    expect(screen.getByRole('status')).toHaveTextContent(/1 foto konnte nicht hochgeladen werden/i)
  })

  it('asks for tickets in groups of three and finishes a group before requesting the next', async () => {
    const user = setupUser()
    const backend = createFakeBackend()
    const files = Array.from({ length: 7 }, (_, i) => makeFile(`photo-${i}.jpg`))

    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), files)
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/7 fotos hochgeladen/i))
    expect(backend.requestBodies.map((body) => body.files.length)).toEqual([3, 3, 1])
    // Ein Ticket gilt nur 15 Minuten - jede Gruppe holt sich ihre Tickets
    // erst, wenn die vorherige komplett fertig ist.
    expect(backend.events).toEqual([
      'request', 'complete', 'complete', 'complete',
      'request', 'complete', 'complete', 'complete',
      'request', 'complete',
    ])
  })

  it('uploads only the files that are not done yet when the guest tries again', async () => {
    const user = setupUser()
    const failComplete = new Set(['b.jpg'])
    const backend = createFakeBackend({ failComplete })
    const onUploaded = vi.fn()

    render(<GalleryUploadForm isAdmin onUploaded={onUploaded} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), [makeFile('a.jpg'), makeFile('b.jpg')])
    await user.click(screen.getByRole('button', { name: /hochladen/i }))
    await screen.findByText('Fehler bei b.jpg')

    failComplete.delete('b.jpg')
    await waitFor(() => expect(screen.getByRole('button', { name: /^hochladen$/i })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: /^hochladen$/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(2))
    expect(backend.requestBodies).toHaveLength(2)
    expect(backend.requestBodies[1].files).toEqual([{ filename: 'b.jpg', size: 100, contentType: 'image/jpeg', thumbSize: 5 }])
  })

  it('tells the guest to keep the page open while uploading, then thanks them', async () => {
    const user = setupUser()
    let release!: () => void
    const holdComplete = new Promise<void>((resolve) => {
      release = resolve
    })
    createFakeBackend({ holdComplete })

    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/seite geöffnet/i))
    // Während des Uploads darf die Auswahl nicht ersetzt werden, sonst
    // würden die index-basierten Statusanzeigen auf neue Dateien zeigen.
    expect(screen.getByLabelText(/fotos ausw/i)).toBeDisabled()

    release()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/1 foto hochgeladen.*danke/i))
    expect(screen.getByLabelText(/fotos ausw/i)).toBeEnabled()
  })

  it('still uploads the original with a placeholder thumbnail when the image cannot be decoded', async () => {
    const user = setupUser()
    const backend = createFakeBackend()
    vi.mocked(createThumbnailBlob).mockRejectedValue(new Error('decode failed'))
    const placeholder = new Blob(['placeholder'])
    vi.mocked(createPlaceholderThumbnailBlob).mockResolvedValue(placeholder)
    const onUploaded = vi.fn()
    const heic = makeFile('IMG_0001.heic', 'image/heic')

    render(<GalleryUploadForm isAdmin onUploaded={onUploaded} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), heic)
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalled())
    expect(backend.fetchMock).toHaveBeenCalledWith(
      'https://r2.example/thumb1',
      expect.objectContaining({ method: 'PUT', body: placeholder })
    )
    expect(backend.fetchMock).toHaveBeenCalledWith(
      'https://r2.example/original1',
      expect.objectContaining({ method: 'PUT', body: heic })
    )
  })

  it('does not register a photo when the storage rejects the upload', async () => {
    const user = setupUser()
    const backend = createFakeBackend({ failPutUrls: new Set(['https://r2.example/thumb1']) })
    const onUploaded = vi.fn()

    render(<GalleryUploadForm isAdmin onUploaded={onUploaded} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(await screen.findByText(/übertragung fehlgeschlagen/i)).toBeInTheDocument()
    expect(backend.events).not.toContain('complete')
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it('names a file with an unsupported type and still uploads the rest of the batch', async () => {
    const user = setupUser()
    const backend = createFakeBackend()
    const onUploaded = vi.fn()

    render(<GalleryUploadForm isAdmin onUploaded={onUploaded} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), [makeFile('anim.gif', 'image/gif'), makeFile('ok.jpg')])

    expect(screen.getByText(/dateityp nicht unterstützt/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1))
    expect(backend.requestBodies[0].files).toEqual([{ filename: 'ok.jpg', size: 100, contentType: 'image/jpeg', thumbSize: 5 }])
  })

  it('names a file that is over the size limit instead of rejecting the whole batch', async () => {
    const user = setupUser()
    const backend = createFakeBackend()
    const big = makeFile('big.jpg')
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 })

    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), [big, makeFile('ok.jpg')])

    expect(screen.getByText(/zu groß/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(backend.requestBodies).toHaveLength(1))
    expect(backend.requestBodies[0].files.map((file) => file.filename)).toEqual(['ok.jpg'])
  })

  it('infers the content type from the extension when the browser reports none', async () => {
    const user = setupUser()
    const backend = createFakeBackend()
    const onUploaded = vi.fn()

    render(<GalleryUploadForm isAdmin onUploaded={onUploaded} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('IMG_0001.HEIC', ''))
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalled())
    expect(backend.requestBodies[0].files[0].contentType).toBe('image/heic')
    expect(backend.fetchMock).toHaveBeenCalledWith(
      'https://r2.example/original1',
      expect.objectContaining({ headers: { 'Content-Type': 'image/heic' } })
    )
  })

  it('shows a preview tile built from the generated thumbnail once a file is uploading', async () => {
    const user = setupUser()
    createFakeBackend()
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('a.jpg'))
    expect(document.querySelector('img')).toBeNull()

    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(document.querySelector('img[src^="blob:preview-"]')).not.toBeNull())
  })

  it('shows a neutral icon instead of a picture when only a placeholder thumbnail exists', async () => {
    const user = setupUser()
    createFakeBackend()
    vi.mocked(createThumbnailBlob).mockRejectedValue(new Error('decode failed'))
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('IMG_1.heic', 'image/heic'))
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await screen.findByText(/1 foto hochgeladen/i)
    expect(document.querySelector('img[src^="blob:preview-"]')).toBeNull()
    expect(screen.getByTestId('upload-preview-fallback')).toBeInTheDocument()
  })

  it('releases preview URLs when the selection is replaced', async () => {
    const user = setupUser()
    createFakeBackend()
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('a.jpg'))
    await user.click(screen.getByRole('button', { name: /hochladen/i }))
    await screen.findByText(/1 foto hochgeladen/i)

    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('b.jpg'))

    expect(revokedUrls).toContain('blob:preview-1')
  })

  it('releases preview URLs when the form unmounts', async () => {
    const user = setupUser()
    createFakeBackend()
    const { unmount } = render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('a.jpg'))
    await user.click(screen.getByRole('button', { name: /hochladen/i }))
    await screen.findByText(/1 foto hochgeladen/i)

    unmount()

    expect(revokedUrls).toContain('blob:preview-1')
  })

  it('marks a file as failed with a timeout message after five minutes without progress', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ applyAccept: false, advanceTimers: vi.advanceTimersByTime })
      createFakeBackend({ hangPuts: true })
      render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
      await user.type(screen.getByLabelText(/dein name/i), 'Anna')
      await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('slow.jpg'))
      await user.click(screen.getByRole('button', { name: /hochladen/i }))

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1)

      expect(await screen.findByText(/zeitüberschreitung/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^hochladen$/i })).toBeEnabled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels running uploads, starts no further group, and lets the files be uploaded again', async () => {
    const user = setupUser()
    const backend = createFakeBackend({ hangPuts: true })
    const files = Array.from({ length: 4 }, (_, i) => makeFile(`photo-${i}.jpg`))
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), files)
    await user.click(screen.getByRole('button', { name: /hochladen/i }))
    await user.click(await screen.findByRole('button', { name: /abbrechen/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /^hochladen$/i })).toBeEnabled())
    // Nur die erste Gruppe (3 Dateien) hat Tickets bekommen, die vierte nie.
    expect(backend.requestBodies).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent(/abgebrochen/i)
    expect(screen.queryByText(/fehlgeschlagen/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/fotos ausw/i)).toBeEnabled()
  })

  it('moves the focus to the upload button when Abbrechen disappears, so keyboard users keep their place', async () => {
    const user = setupUser()
    createFakeBackend({ hangPuts: true })
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))
    await user.click(await screen.findByRole('button', { name: /abbrechen/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /^hochladen$/i })).toBeEnabled())
    expect(screen.getByRole('button', { name: /^hochladen$/i })).toHaveFocus()
  })

  it('does not pull the focus back to the upload button when the guest has moved on in the meantime', async () => {
    const user = setupUser()
    let release!: () => void
    const holdComplete = new Promise<void>((resolve) => {
      release = resolve
    })
    const backend = createFakeBackend({ holdComplete })
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('a.jpg'))
    await user.click(screen.getByRole('button', { name: /hochladen/i }))
    await waitFor(() => expect(backend.events).toContain('complete'))
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))

    // Das Registrieren läuft weiter; der Gast tippt inzwischen im Namensfeld.
    await user.click(screen.getByLabelText(/dein name/i))
    release()

    await screen.findByText(/1 foto hochgeladen/i)
    expect(screen.getByLabelText(/dein name/i)).toHaveFocus()
  })

  it('does not show the cancel button while idle', () => {
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /abbrechen/i })).not.toBeInTheDocument()
  })

  it('lets a file whose bytes are already stored finish registering when the guest presses Abbrechen', async () => {
    const user = setupUser()
    let release!: () => void
    const holdComplete = new Promise<void>((resolve) => {
      release = resolve
    })
    const backend = createFakeBackend({ holdComplete })
    const onUploaded = vi.fn()
    render(<GalleryUploadForm isAdmin onUploaded={onUploaded} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('a.jpg'))
    await user.click(screen.getByRole('button', { name: /hochladen/i }))
    await waitFor(() => expect(backend.events).toContain('complete'))

    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    release()

    // Der Server registriert das Foto in jedem Fall - die Seite muss es
    // genauso zeigen, sonst entsteht beim erneuten Versuch ein Duplikat.
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/1 foto hochgeladen/i)).toBeInTheDocument()
    expect(backend.requestBodies).toHaveLength(1)
  })

  it('does not time out a file whose bytes are already stored while the registration is slow', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ applyAccept: false, advanceTimers: vi.advanceTimersByTime })
      let release!: () => void
      const holdComplete = new Promise<void>((resolve) => {
        release = resolve
      })
      const backend = createFakeBackend({ putDelayMs: 4 * 60 * 1000 + 50 * 1000, holdComplete })
      render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
      await user.type(screen.getByLabelText(/dein name/i), 'Anna')
      await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('slow.jpg'))
      await user.click(screen.getByRole('button', { name: /hochladen/i }))

      await vi.advanceTimersByTimeAsync(4 * 60 * 1000 + 50 * 1000)
      await waitFor(() => expect(backend.events).toContain('complete'))
      // Gesamtzeit jetzt über fünf Minuten: das Zeitlimit für die Übertragung
      // darf die bereits gespeicherten Bytes nicht mehr betreffen.
      await vi.advanceTimersByTimeAsync(20 * 1000)
      release()

      expect(await screen.findByText(/1 foto hochgeladen/i)).toBeInTheDocument()
      expect(screen.queryByText(/zeitüberschreitung/i)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives a group of large photos on a slow connection more than five minutes before it counts as stuck', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ applyAccept: false, advanceTimers: vi.advanceTimersByTime })
      createFakeBackend({ hangPuts: true })
      const files = [1, 2, 3].map((n) => {
        const file = makeFile(`big-${n}.jpg`)
        // 3 x 4 MB teilen sich eine Leitung: bei 20 KB/s sind das gut 10 Minuten.
        Object.defineProperty(file, 'size', { value: 4 * 1024 * 1024 })
        return file
      })
      render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
      await user.type(screen.getByLabelText(/dein name/i), 'Anna')
      await user.upload(screen.getByLabelText(/fotos ausw/i), files)
      await user.click(screen.getByRole('button', { name: /hochladen/i }))

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000)
      expect(screen.queryByText(/zeitüberschreitung/i)).not.toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 20 * 1000)
      expect(await screen.findAllByText(/zeitüberschreitung/i)).toHaveLength(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('counts every photo that was not uploaded after a cancel, including groups that never started', async () => {
    const user = setupUser()
    createFakeBackend({ hangPuts: true })
    const files = Array.from({ length: 4 }, (_, i) => makeFile(`photo-${i}.jpg`))
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), files)
    await user.click(screen.getByRole('button', { name: /hochladen/i }))
    await user.click(await screen.findByRole('button', { name: /abbrechen/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /^hochladen$/i })).toBeEnabled())
    expect(screen.getByRole('status')).toHaveTextContent(/4 fotos wurden abgebrochen/i)
  })

  it('does not invite a retry when uploads were paused while a file was on its way', async () => {
    const user = setupUser()
    createFakeBackend({ failComplete: new Set(['a.jpg']), completeError: 'Foto-Uploads sind derzeit pausiert.' })
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('a.jpg'))
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await screen.findByText('Foto-Uploads sind derzeit pausiert.')

    expect(screen.getByRole('status')).toHaveTextContent(/pausiert/i)
    expect(screen.getByRole('status')).not.toHaveTextContent(/tippe erneut/i)
  })

  it('keeps the status line and the cancel button in view by scrolling a long file list inside its own box', async () => {
    const user = setupUser()
    createFakeBackend()
    const files = Array.from({ length: 12 }, (_, i) => makeFile(`photo-${i}.jpg`))
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.upload(screen.getByLabelText(/fotos ausw/i), files)

    expect(screen.getByRole('list')).toHaveClass('max-h-[28rem]', 'overflow-y-auto')
  })

  it('tells an admin whose session expired to log in again instead of asking for a password', async () => {
    const user = setupUser()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Falsches Kennwort.' }) })
    )
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Saruga')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/sitzung abgelaufen/i)
    expect(screen.queryByText(/falsches kennwort/i)).not.toBeInTheDocument()
  })

  it('stops the other transfer of a photo when one of its two PUTs fails', async () => {
    const user = setupUser()
    const backend = createFakeBackend()
    let originalSignal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === 'https://r2.example/thumb1') return Promise.reject(new TypeError('Failed to fetch'))
        if (url === 'https://r2.example/original1') {
          originalSignal = init?.signal ?? undefined
          return new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          })
        }
        return backend.fetchMock(url, init)
      })
    )
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Anna')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/nicht hochgeladen werden/i))
    expect(originalSignal?.aborted).toBe(true)
  })

  it('also reports an expired admin session while guest uploads are locked, not "pausiert"', async () => {
    // Bei gesperrtem Foto-Upload prüft der Server die Sperre vor der Anmeldung:
    // ein Admin mit abgelaufener Sitzung bekäme sonst 423 statt 401.
    const user = setupUser()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 423, json: async () => ({ error: 'Foto-Uploads sind derzeit pausiert.' }) })
    )
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await user.type(screen.getByLabelText(/dein name/i), 'Saruga')
    await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await user.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/sitzung abgelaufen/i)
    expect(screen.queryByText(/pausiert/i)).not.toBeInTheDocument()
  })
})
