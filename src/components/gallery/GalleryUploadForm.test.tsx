import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
}

// Minimaler Server: vergibt je Datei ein Ticket, erkennt R2-PUTs und beantwortet
// /complete. `events` hält die Reihenfolge der Server-Aufrufe fest.
function createFakeBackend(options: FakeBackendOptions = {}) {
  const events: string[] = []
  const requestBodies: { files: { filename: string; size: number; contentType: string }[]; [key: string]: unknown }[] = []
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
      if (options.holdComplete) await options.holdComplete
      const filename = filenameByTicket.get(ticket) as string
      if (options.failComplete?.has(filename)) {
        return { ok: false, json: async () => ({ error: `Fehler bei ${filename}` }) }
      }
      const id = ticket.replace('ticket-', 'p')
      return {
        ok: true,
        json: async () => ({
          photo: {
            id,
            uploaderName: 'Anna',
            category: 'Hochzeit',
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
    expect(screen.getByLabelText(/kategorie/i)).toHaveValue('Hochzeit')
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
      files: [{ filename: 'photo.jpg', size: 100, contentType: 'image/jpeg' }],
    })
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
      category: 'Hochzeit',
      files: [{ filename: 'photo.jpg', size: 100, contentType: 'image/jpeg' }],
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
    expect(backend.requestBodies[1].files).toEqual([{ filename: 'b.jpg', size: 100, contentType: 'image/jpeg' }])
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
    expect(backend.requestBodies[0].files).toEqual([{ filename: 'ok.jpg', size: 100, contentType: 'image/jpeg' }])
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

  it('does not show the cancel button while idle', () => {
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /abbrechen/i })).not.toBeInTheDocument()
  })
})
