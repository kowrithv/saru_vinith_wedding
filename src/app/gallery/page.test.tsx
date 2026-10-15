import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GalleryPage from './page'
import { bodyOf, callsTo, mockFetchRoutes, type MockResponse } from '@/test-utils/mock-fetch'

// Das Formular hat eigene Tests - hier zählt nur, wie die Seite darauf
// reagiert (ein Klick auf "stub-upload" meldet ein fertig hochgeladenes Foto).
vi.mock('@/components/gallery/GalleryUploadForm', () => ({
  default: ({
    onUploaded,
    onBusyChange,
    hasAccess,
  }: {
    onUploaded: (photo: unknown) => void
    onBusyChange?: (busy: boolean) => void
    hasAccess?: boolean
  }) => (
    <form aria-label="Upload-Formular" data-has-access={String(Boolean(hasAccess))}>
      <label>
        Dein Name
        <input />
      </label>
      <button
        type="button"
        onClick={() =>
          onUploaded({
            id: 'new-photo',
            uploaderName: 'Ben',
            category: 'Party',
            isOfficial: false,
            createdAt: '2026-10-12T11:00:00.000Z',
            thumbUrl: 'https://fotos.example.de/new-photo/thumb.jpg',
            originalUrl: 'https://fotos.example.de/new-photo/original.jpg',
          })
        }
      >
        stub-upload
      </button>
      <button type="button" onClick={() => onBusyChange?.(true)}>
        stub-busy
      </button>
      <button type="button" onClick={() => onBusyChange?.(false)}>
        stub-idle
      </button>
    </form>
  ),
}))

// Der Browser ist standardmäßig entsperrt (Sitzung vorhanden); Tests, die das
// Kennwortformular brauchen, setzen access: false.
function mockApi(gallery: MockResponse | MockResponse[], options: { access?: boolean; unlock?: MockResponse } = {}) {
  const { access = true, unlock = { body: { success: true } } } = options
  return mockFetchRoutes({
    '/api/access': { body: { unlocked: access } },
    '/api/gallery': gallery,
    '/api/gallery/unlock': unlock,
  })
}

const samplePhoto = {
  id: 'p1',
  uploaderName: 'Anna',
  category: 'Standesamt',
  isOfficial: false,
  createdAt: '2026-10-12T10:00:00.000Z',
  thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
  originalUrl: 'https://fotos.example.de/p1/original.jpg',
}

describe('GalleryPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/gallery')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the gallery grid directly when the gallery is public', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, photos: [samplePhoto] } })
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
  })

  it('shows the password form when the gallery is locked', async () => {
    mockApi({ body: { mode: 'password', unlocked: false, photos: null } }, { access: false })
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())
  })

  it('shows the gallery after a successful unlock', async () => {
    const fetchMock = mockApi(
      [
        { body: { mode: 'password', unlocked: false, photos: null } },
        { body: { mode: 'password', unlocked: true, photos: [samplePhoto] } },
      ],
      { access: false }
    )
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/kennwort/i), 'empfang-secret')
    await userEvent.click(screen.getByRole('button', { name: /galerie ansehen/i }))

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, '/api/gallery/unlock')[0])).toEqual({ password: 'empfang-secret' })
    expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
  })

  it('does not show a single photo before the password was given', async () => {
    mockApi({ body: { mode: 'password', unlocked: false, photos: null } }, { access: false })
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())

    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /fotos hochladen/i })).not.toBeInTheDocument()
  })

  it('opens straight away for a browser that is already unlocked, without asking', async () => {
    mockApi({ body: { mode: 'password', unlocked: true, photos: [samplePhoto] } })
    render(<GalleryPage />)

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
    expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
  })

  it('opens from the QR link: unlocks first, loads the photos afterwards and clears the address', async () => {
    window.history.replaceState(null, '', '/gallery#k=Hochzeit')
    const order: string[] = []
    const fetchMock = mockFetchRoutes({
      '/api/gallery/unlock': () => {
        order.push('unlock')
        return { body: { success: true } }
      },
      '/api/gallery': () => {
        order.push('gallery')
        return { body: { mode: 'password', unlocked: true, photos: [samplePhoto] } }
      },
    })
    render(<GalleryPage />)

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
    expect(order).toEqual(['unlock', 'gallery'])
    expect(bodyOf(callsTo(fetchMock, '/api/gallery/unlock')[0])).toEqual({ password: 'Hochzeit' })
    expect(window.location.hash).toBe('')
    expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
  })

  it('falls back to the password form when the QR link carries an outdated password', async () => {
    window.history.replaceState(null, '', '/gallery#k=Altes-Wort')
    mockFetchRoutes({
      '/api/gallery/unlock': { status: 401, body: { error: 'Falsches Kennwort.' } },
      '/api/gallery': { body: { mode: 'password', unlocked: false, photos: null } },
    })
    render(<GalleryPage />)

    await waitFor(() => expect(screen.getByLabelText(/kennwort vom empfang/i)).toBeInTheDocument())
    expect(screen.getByText(/qr-code ist nicht mehr gültig/i)).toBeInTheDocument()
  })

  it('shows an error and stays locked when the password is wrong', async () => {
    mockApi(
      { body: { mode: 'password', unlocked: false, photos: null } },
      { access: false, unlock: { status: 401, body: { error: 'Falsches Kennwort.' } } }
    )
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/kennwort/i), 'falsch')
    await userEvent.click(screen.getByRole('button', { name: /galerie ansehen/i }))

    await waitFor(() => expect(screen.getByText('Falsches Kennwort.')).toBeInTheDocument())
    expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, photos: [] } })
    const { container } = render(<GalleryPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pt-24'))
  })

  it('leaves room below the content so the floating upload button never covers the last controls', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, photos: [] } })
    const { container } = render(<GalleryPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pb-28'))
  })

  it('shows an error state with a retry option, not the password form, when loading fails', async () => {
    mockApi({ status: 500, body: { error: 'Serverfehler' } })
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /erneut versuchen/i })).toBeInTheDocument())
    expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
  })

  it('labels the password field consistently with the rest of the site', async () => {
    mockApi({ body: { mode: 'password', unlocked: false, photos: null } }, { access: false })
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort vom empfang/i)).toBeInTheDocument())
  })

  it('shows the upload form when the floating button is clicked', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, photos: [] } })
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /fotos hochladen/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /fotos hochladen/i }))
    expect(screen.getByLabelText(/dein name/i)).toBeInTheDocument()
  })

  it('tells the upload form whether this browser is already unlocked', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, photos: [] } }, { access: false })
    const { unmount } = render(<GalleryPage />)
    await userEvent.click(await screen.findByRole('button', { name: /fotos hochladen/i }))
    expect(screen.getByRole('form', { name: /upload-formular/i })).toHaveAttribute('data-has-access', 'false')
    unmount()

    mockApi({ body: { mode: 'public', unlocked: true, photos: [] } }, { access: true })
    render(<GalleryPage />)
    await userEvent.click(await screen.findByRole('button', { name: /fotos hochladen/i }))
    expect(screen.getByRole('form', { name: /upload-formular/i })).toHaveAttribute('data-has-access', 'true')
  })

  it('adds an uploaded photo to the grid and keeps the form open for the rest of the batch', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, photos: [samplePhoto] } })
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

    await userEvent.click(screen.getByRole('button', { name: /fotos hochladen/i }))
    await userEvent.click(screen.getByRole('button', { name: 'stub-upload' }))

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
    expect(screen.getByRole('form', { name: /upload-formular/i })).toBeInTheDocument()
  })

  it('turns the floating button into a close toggle that reports its state', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, photos: [] } })
    render(<GalleryPage />)
    const openButton = await screen.findByRole('button', { name: /fotos hochladen/i })
    expect(openButton).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(openButton)
    const closeButton = screen.getByRole('button', { name: /schließen/i })
    expect(closeButton).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(closeButton)
    expect(screen.getByLabelText(/dein name/i)).not.toBeVisible()
    expect(screen.getByRole('button', { name: /fotos hochladen/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('shrinks the floating button to a round close button while the form is open', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, photos: [samplePhoto] } })
    render(<GalleryPage />)
    const open = await screen.findByRole('button', { name: /fotos hochladen/i })
    expect(open).toHaveClass('px-5')

    await userEvent.click(open)

    const close = screen.getByRole('button', { name: 'Schließen' })
    expect(close).toHaveClass('h-12', 'w-12')
    expect(close).not.toHaveClass('px-5')
    expect(close).toHaveAttribute('aria-expanded', 'true')
    expect(close).toHaveTextContent('')
  })

  it('only hides the form on close, so running uploads and what was typed survive', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, photos: [] } })
    render(<GalleryPage />)
    await userEvent.click(await screen.findByRole('button', { name: /fotos hochladen/i }))
    await userEvent.type(screen.getByLabelText(/dein name/i), 'Ben')

    await userEvent.click(screen.getByRole('button', { name: /schließen/i }))
    await userEvent.click(screen.getByRole('button', { name: /fotos hochladen/i }))

    expect(screen.getByLabelText(/dein name/i)).toBeVisible()
    expect(screen.getByLabelText(/dein name/i)).toHaveValue('Ben')
  })

  it('does not render the form at all before the first open', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, photos: [] } })
    render(<GalleryPage />)
    await screen.findByRole('button', { name: /fotos hochladen/i })

    expect(screen.queryByLabelText(/dein name/i)).not.toBeInTheDocument()
  })

  it('scrolls the form into view and focuses its first field when it opens', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    mockApi({ body: { mode: 'public', unlocked: true, photos: [] } })
    render(<GalleryPage />)

    await userEvent.click(await screen.findByRole('button', { name: /fotos hochladen/i }))

    expect(scrollIntoView).toHaveBeenCalled()
    expect(screen.getByLabelText(/dein name/i)).toHaveFocus()
  })

  it('keeps the floating button below the mobile menu overlay', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, photos: [] } })
    render(<GalleryPage />)
    const button = await screen.findByRole('button', { name: /fotos hochladen/i })
    // Das Mobil-Menü liegt auf z-40, die Lightbox und die Navigation auf z-50.
    expect(button).toHaveClass('z-30')
  })

  it('hides the upload button and explains why while uploads are locked', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, uploadsLocked: true, photos: [samplePhoto] } })
    render(<GalleryPage />)

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
    expect(screen.queryByRole('button', { name: /fotos hochladen/i })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/hochladen ist gerade pausiert/i)
  })

  it('does not tell guests to upload the first photo while uploads are paused', async () => {
    mockApi({ body: { mode: 'public', unlocked: true, uploadsLocked: true, photos: [] } })
    render(<GalleryPage />)

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/pausiert/i))
    expect(screen.queryByText(/lade das erste hoch/i)).not.toBeInTheDocument()
    expect(screen.getByText(/noch keine fotos/i)).toBeInTheDocument()
  })

  describe('reloading by itself', () => {
    const newPhoto = {
      id: 'p2',
      uploaderName: 'Ben',
      category: 'Party',
      isOfficial: false,
      createdAt: '2026-10-12T12:00:00.000Z',
      thumbUrl: 'https://fotos.example.de/p2/thumb.jpg',
      originalUrl: 'https://fotos.example.de/p2/original.jpg',
    }
    const body = (photos: unknown[]) => ({ body: { mode: 'public', unlocked: true, photos } })

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    async function tick(ms: number) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    }

    it('shows photos that others uploaded in the meantime', async () => {
      const fetchMock = mockApi([body([samplePhoto]), body([newPhoto, samplePhoto])])
      render(<GalleryPage />)
      await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

      await tick(30_000)

      await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
      expect(callsTo(fetchMock, '/api/gallery')).toHaveLength(2)
    })

    describe('asking cheaply whether anything changed', () => {
      const tagged = (photos: unknown[], etag: string) => ({ ...body(photos), headers: { etag } })
      const sentTags = (fetchMock: ReturnType<typeof mockApi>) =>
        callsTo(fetchMock, '/api/gallery').map(
          ([, init]) => ((init as RequestInit | undefined)?.headers as Record<string, string> | undefined)?.['If-None-Match']
        )

      it('sends the ETag of the last list along and keeps everything when the answer is 304', async () => {
        const fetchMock = mockApi([tagged([samplePhoto], '"v1"'), { status: 304, body: null, headers: { etag: '"v1"' } }])
        render(<GalleryPage />)
        const before = await screen.findByRole('img')

        await tick(30_000)
        await tick(30_000)

        expect(sentTags(fetchMock).slice(0, 2)).toEqual([undefined, '"v1"'])
        expect(screen.getByRole('img')).toBe(before)
        expect(screen.queryByText(/konnte nicht geladen werden/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /neue.*foto.*anzeigen/i })).not.toBeInTheDocument()
      })

      it('uses the newer ETag after a changed list came in', async () => {
        const fetchMock = mockApi([
          tagged([samplePhoto], '"v1"'),
          tagged([newPhoto, samplePhoto], '"v2"'),
          { status: 304, body: null, headers: { etag: '"v2"' } },
        ])
        render(<GalleryPage />)
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

        await tick(30_000)
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
        await tick(30_000)

        expect(sentTags(fetchMock).slice(0, 3)).toEqual([undefined, '"v1"', '"v2"'])
        expect(screen.getAllByRole('img')).toHaveLength(2)
      })

      it('keeps asking with the same ETag while a newer list waits behind the button', async () => {
        window.scrollY = 900
        window.scrollTo = vi.fn()
        const fetchMock = mockApi([
          tagged([samplePhoto], '"v1"'),
          tagged([newPhoto, samplePhoto], '"v2"'),
          { status: 304, body: null, headers: { etag: '"v2"' } },
        ])
        render(<GalleryPage />)
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

        await tick(30_000)
        await screen.findByRole('button', { name: '1 neues Foto anzeigen' })
        await tick(30_000)

        expect(sentTags(fetchMock).slice(0, 3)).toEqual([undefined, '"v1"', '"v2"'])
        expect(screen.getByRole('button', { name: '1 neues Foto anzeigen' })).toBeInTheDocument()
      })

      it('works without any ETag (older server answers)', async () => {
        const fetchMock = mockApi([body([samplePhoto]), body([newPhoto, samplePhoto])])
        render(<GalleryPage />)
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

        await tick(30_000)

        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
        expect(sentTags(fetchMock)).toEqual([undefined, undefined])
      })
    })

    it('looks again every 30 seconds, not more often', async () => {
      const fetchMock = mockApi(body([samplePhoto]))
      render(<GalleryPage />)
      await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

      await tick(29_000)
      expect(callsTo(fetchMock, '/api/gallery')).toHaveLength(1)

      await tick(1_000)
      expect(callsTo(fetchMock, '/api/gallery')).toHaveLength(2)
      await tick(30_000)
      expect(callsTo(fetchMock, '/api/gallery')).toHaveLength(3)
    })

    it('does not reload while a photo is being uploaded, and resumes afterwards', async () => {
      const fetchMock = mockApi([body([samplePhoto]), body([newPhoto, samplePhoto])])
      render(<GalleryPage />)
      await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
      await userEvent.click(screen.getByRole('button', { name: /fotos hochladen/i }))
      await userEvent.click(screen.getByRole('button', { name: 'stub-busy' }))

      await tick(120_000)
      expect(callsTo(fetchMock, '/api/gallery')).toHaveLength(1)
      expect(screen.getAllByRole('img')).toHaveLength(1)

      await userEvent.click(screen.getByRole('button', { name: 'stub-idle' }))
      await tick(30_000)

      await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
      expect(callsTo(fetchMock, '/api/gallery')).toHaveLength(2)
    })

    it('does not reload in a hidden tab, but looks at once when the tab is back', async () => {
      const fetchMock = mockApi([body([samplePhoto]), body([newPhoto, samplePhoto])])
      render(<GalleryPage />)
      await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

      Object.defineProperty(document, 'hidden', { value: true, configurable: true })
      await tick(90_000)
      expect(callsTo(fetchMock, '/api/gallery')).toHaveLength(1)

      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
    })

    it('keeps the photo that was just uploaded when an older answer arrives afterwards', async () => {
      let resolveStale: (value: Response) => void = () => {}
      let calls = 0
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const path = String(input).split('?')[0]
          if (path === '/api/access') return { ok: true, status: 200, json: async () => ({ unlocked: true }) } as Response
          if (path === '/api/gallery') {
            calls += 1
            if (calls === 1) return { ok: true, status: 200, json: async () => body([samplePhoto]).body } as Response
            // Die zweite Antwort (Neuladen) kommt erst später: sie kennt das gerade
            // hochgeladene Foto noch nicht, dafür das eines anderen Gastes.
            return new Promise<Response>((resolve) => {
              resolveStale = resolve
            })
          }
          throw new Error(`unexpected ${path}`)
        })
      )
      render(<GalleryPage />)
      await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
      await userEvent.click(screen.getByRole('button', { name: /fotos hochladen/i }))

      await tick(30_000) // das Neuladen ist unterwegs
      await userEvent.click(screen.getByRole('button', { name: 'stub-upload' })) // das Foto ist da
      await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))

      await act(async () => {
        resolveStale({ ok: true, status: 200, json: async () => body([newPhoto, samplePhoto]).body } as Response)
      })

      const sources = screen.getAllByRole('img').map((img) => img.getAttribute('src'))
      expect(sources).toContain('https://fotos.example.de/new-photo/thumb.jpg')
    })

    it('keeps what is shown when a reload fails', async () => {
      mockApi([body([samplePhoto]), { status: 500, body: {} }])
      render(<GalleryPage />)
      await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

      await tick(30_000)

      expect(screen.getAllByRole('img')).toHaveLength(1)
      expect(screen.queryByText(/konnte nicht geladen werden/i)).not.toBeInTheDocument()
    })

    it('does not touch the list when nothing changed', async () => {
      mockApi(body([samplePhoto]))
      render(<GalleryPage />)
      const before = await screen.findByRole('img')

      await tick(60_000)

      expect(screen.getByRole('img')).toBe(before)
    })

    it('does not reload while the password form is shown', async () => {
      const fetchMock = mockApi({ body: { mode: 'password', unlocked: false, photos: null } }, { access: false })
      render(<GalleryPage />)
      await screen.findByLabelText(/kennwort/i)

      await tick(120_000)

      expect(callsTo(fetchMock, '/api/gallery')).toHaveLength(1)
    })

    describe('when the guest has scrolled down', () => {
      beforeEach(() => {
        window.scrollY = 900
        window.scrollTo = vi.fn()
      })

      it('does not move the grid but offers the new photos in a button', async () => {
        mockApi([body([samplePhoto]), body([newPhoto, samplePhoto])])
        render(<GalleryPage />)
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

        await tick(30_000)

        expect(await screen.findByRole('button', { name: '1 neues Foto anzeigen' })).toBeInTheDocument()
        expect(screen.getAllByRole('img')).toHaveLength(1)
      })

      it('shows them and scrolls to the top when the button is tapped', async () => {
        mockApi([body([samplePhoto]), body([newPhoto, samplePhoto])])
        render(<GalleryPage />)
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
        await tick(30_000)

        await userEvent.click(await screen.findByRole('button', { name: /neue.*foto.*anzeigen/i }))

        expect(screen.getAllByRole('img')).toHaveLength(2)
        expect(screen.queryByRole('button', { name: /neue.*foto.*anzeigen/i })).not.toBeInTheDocument()
        expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
      })

      it('counts several new photos', async () => {
        const third = { ...newPhoto, id: 'p3' }
        mockApi([body([samplePhoto]), body([third, newPhoto, samplePhoto])])
        render(<GalleryPage />)
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

        await tick(30_000)

        expect(await screen.findByRole('button', { name: '2 neue Fotos anzeigen' })).toBeInTheDocument()
      })

      it('does not offer anything for a removed photo and leaves the grid alone', async () => {
        mockApi([body([newPhoto, samplePhoto]), body([samplePhoto])])
        render(<GalleryPage />)
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))

        await tick(30_000)

        expect(screen.queryByRole('button', { name: /neue.*foto.*anzeigen/i })).not.toBeInTheDocument()
        expect(screen.getAllByRole('img')).toHaveLength(2)
      })
    })
  })
})
