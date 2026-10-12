import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GalleryPage from './page'

// Das Formular hat eigene Tests - hier zählt nur, wie die Seite darauf
// reagiert (ein Klick auf "stub-upload" meldet ein fertig hochgeladenes Foto).
vi.mock('@/components/gallery/GalleryUploadForm', () => ({
  default: ({ onUploaded }: { onUploaded: (photo: unknown) => void }) => (
    <form aria-label="Upload-Formular">
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
    </form>
  ),
}))

function mockFetchSequence(responses: { status?: number; body: unknown }[]) {
  const fn = vi.fn()
  responses.forEach(({ status = 200, body }) => {
    fn.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const samplePhoto = {
  id: 'p1',
  uploaderName: 'Anna',
  category: 'Hochzeit',
  isOfficial: false,
  createdAt: '2026-10-12T10:00:00.000Z',
  thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
  originalUrl: 'https://fotos.example.de/p1/original.jpg',
}

describe('GalleryPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the gallery grid directly when the gallery is public', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [samplePhoto] } }])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
  })

  it('shows the password form when the gallery is locked', async () => {
    mockFetchSequence([{ body: { mode: 'password', unlocked: false, photos: null } }])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())
  })

  it('shows the gallery after a successful unlock', async () => {
    const fetchMock = mockFetchSequence([
      { body: { mode: 'password', unlocked: false, photos: null } },
      { body: { success: true } },
      { body: { mode: 'password', unlocked: true, photos: [samplePhoto] } },
    ])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/kennwort/i), 'empfang-secret')
    await userEvent.click(screen.getByRole('button', { name: /galerie ansehen/i }))

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('shows an error and stays locked when the password is wrong', async () => {
    mockFetchSequence([
      { body: { mode: 'password', unlocked: false, photos: null } },
      { status: 401, body: { error: 'Falsches Kennwort.' } },
    ])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/kennwort/i), 'falsch')
    await userEvent.click(screen.getByRole('button', { name: /galerie ansehen/i }))

    await waitFor(() => expect(screen.getByText('Falsches Kennwort.')).toBeInTheDocument())
    expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [] } }])
    const { container } = render(<GalleryPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pt-24'))
  })

  it('shows an error state with a retry option, not the password form, when loading fails', async () => {
    mockFetchSequence([{ status: 500, body: { error: 'Serverfehler' } }])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /erneut versuchen/i })).toBeInTheDocument())
    expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
  })

  it('labels the password field consistently with the rest of the site', async () => {
    mockFetchSequence([{ body: { mode: 'password', unlocked: false, photos: null } }])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort vom empfang/i)).toBeInTheDocument())
  })

  it('shows the upload form when the floating button is clicked', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [] } }])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /fotos hochladen/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /fotos hochladen/i }))
    expect(screen.getByLabelText(/dein name/i)).toBeInTheDocument()
  })

  it('adds an uploaded photo to the grid and keeps the form open for the rest of the batch', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [samplePhoto] } }])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

    await userEvent.click(screen.getByRole('button', { name: /fotos hochladen/i }))
    await userEvent.click(screen.getByRole('button', { name: 'stub-upload' }))

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
    expect(screen.getByRole('form', { name: /upload-formular/i })).toBeInTheDocument()
  })

  it('turns the floating button into a close toggle that reports its state', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [] } }])
    render(<GalleryPage />)
    const openButton = await screen.findByRole('button', { name: /fotos hochladen/i })
    expect(openButton).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(openButton)
    const closeButton = screen.getByRole('button', { name: /schließen/i })
    expect(closeButton).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(closeButton)
    expect(screen.queryByLabelText(/dein name/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fotos hochladen/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('scrolls the form into view and focuses its first field when it opens', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [] } }])
    render(<GalleryPage />)

    await userEvent.click(await screen.findByRole('button', { name: /fotos hochladen/i }))

    expect(scrollIntoView).toHaveBeenCalled()
    expect(screen.getByLabelText(/dein name/i)).toHaveFocus()
  })

  it('keeps the floating button below the mobile menu overlay', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [] } }])
    render(<GalleryPage />)
    const button = await screen.findByRole('button', { name: /fotos hochladen/i })
    // Das Mobil-Menü liegt auf z-40, die Lightbox und die Navigation auf z-50.
    expect(button).toHaveClass('z-30')
  })

  it('hides the upload button and explains why while uploads are locked', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, uploadsLocked: true, photos: [samplePhoto] } }])
    render(<GalleryPage />)

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
    expect(screen.queryByRole('button', { name: /fotos hochladen/i })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/hochladen ist gerade pausiert/i)
  })

  it('keeps the upload flag when a photo is added afterwards', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, uploadsLocked: false, photos: [samplePhoto] } }])
    render(<GalleryPage />)
    await userEvent.click(await screen.findByRole('button', { name: /fotos hochladen/i }))
    await userEvent.click(screen.getByRole('button', { name: 'stub-upload' }))

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
    expect(screen.getByRole('button', { name: /schließen/i })).toBeInTheDocument()
  })
})
