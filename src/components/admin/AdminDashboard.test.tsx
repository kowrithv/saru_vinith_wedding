import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminDashboard from './AdminDashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Das Formular hat eigene Tests - hier zählt nur, dass es als Admin-Formular
// eingebunden ist und ein fertiges Foto in der Liste landet.
vi.mock('@/components/gallery/GalleryUploadForm', () => ({
  default: ({ isAdmin, onUploaded }: { isAdmin?: boolean; onUploaded: (photo: unknown) => void }) => (
    <button
      type="button"
      data-admin={String(Boolean(isAdmin))}
      onClick={() =>
        onUploaded({
          id: 'uploaded',
          uploaderName: 'Saruga',
          category: 'Verlobung',
          isOfficial: true,
          createdAt: '2026-10-12T11:00:00.000Z',
          thumbUrl: 'https://fotos.example.de/uploaded/thumb.jpg',
          originalUrl: 'https://fotos.example.de/uploaded/original.jpg',
        })
      }
    >
      stub-upload
    </button>
  ),
}))

function mockFetchSequence(
  responses: { status?: number; body: unknown }[],
  options: { memoryRecord?: { moves: number; seconds: number } | null } = {}
) {
  const fn = vi.fn()
  responses.forEach(({ status = 200, body }) => {
    fn.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body })
  })
  // Das Laden des Memory-Rekords (GET) läuft außerhalb der Reihenfolge der
  // übrigen Aufrufe, damit deren Mock-Sequenzen unverändert bleiben.
  const routed = (url: string, init?: RequestInit) => {
    if (url === '/api/memory-record' && (!init || !init.method || init.method === 'GET')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ record: options.memoryRecord ?? null }) })
    }
    return fn(url, init)
  }
  vi.stubGlobal('fetch', routed)
  return fn
}

const noLocks = { guestbook: false, memories: false, who_votes: false, gallery_upload: false }

// Die Mount-Fetches laufen in dieser Reihenfolge: Gästebuch, Erinnerungen,
// Galerie-Fotos. Alles danach (Umschalten, Löschen) hängt hinten an.
const noGalleryPhotos = { body: { photos: [] } }

const annaPhoto = {
  id: 'p1',
  uploaderName: 'Anna',
  category: 'Hochzeit',
  isOfficial: false,
  createdAt: '2026-10-12T10:00:00.000Z',
  thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
  originalUrl: 'https://fotos.example.de/p1/original.jpg',
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads and shows guestbook and memories entries', async () => {
    mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [{ id: 5, name: 'Ben', message: 'Schöne Erinnerung an euch.', photoKey: null, createdAt: '2026-10-11T11:00:00.000Z' }] } },
      noGalleryPhotos,
    ])

    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)

    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())
    expect(screen.getByText(/Schöne Erinnerung an euch\./)).toBeInTheDocument()
  })

  it('shows three independent switches, all unlocked by default', async () => {
    const fetchMock = mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: /erinnerungen/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: /wer-von-uns/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('applies each answer only to its own switch, even when answers arrive in the wrong order', async () => {
    const fetchMock = mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos])
    let answerGuestbook!: (value: unknown) => void
    let answerMemories!: (value: unknown) => void
    fetchMock
      .mockReturnValueOnce(new Promise((resolve) => { answerGuestbook = resolve }))
      .mockReturnValueOnce(new Promise((resolve) => { answerMemories = resolve }))
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    await userEvent.click(screen.getByRole('switch', { name: /gästebuch/i }))
    await userEvent.click(screen.getByRole('switch', { name: /erinnerungen/i }))

    // Die Antwort auf die zweite Änderung kommt zuerst; die ältere Antwort
    // enthält noch den Stand vor ihr und darf sie nicht überschreiben.
    answerMemories({
      ok: true,
      status: 200,
      json: async () => ({ locks: { guestbook: true, memories: true, who_votes: false, gallery_upload: false } }),
    })
    answerGuestbook({
      ok: true,
      status: 200,
      json: async () => ({ locks: { guestbook: true, memories: false, who_votes: false, gallery_upload: false } }),
    })

    await waitFor(() => expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getByRole('switch', { name: /erinnerungen/i })).toHaveAttribute('aria-checked', 'true')
    // Nach der Antwort ist jeder Schalter wieder bedienbar.
    await waitFor(() => expect(screen.getByRole('switch', { name: /gästebuch/i })).toBeEnabled())
    expect(screen.getByRole('switch', { name: /erinnerungen/i })).toBeEnabled()
  })

  it('keeps the error of a failed switch visible when another switch is toggled afterwards', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      noGalleryPhotos,
      { status: 500, body: { error: 'Serverfehler' } },
      { body: { locks: { guestbook: false, memories: true, who_votes: false, gallery_upload: false } } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    await userEvent.click(screen.getByRole('switch', { name: /gästebuch/i }))
    await waitFor(() => expect(screen.getByText(/umschalten fehlgeschlagen/i)).toBeInTheDocument())
    await userEvent.click(screen.getByRole('switch', { name: /erinnerungen/i }))

    await waitFor(() => expect(screen.getByRole('switch', { name: /erinnerungen/i })).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getByText(/umschalten fehlgeschlagen/i)).toBeInTheDocument()
  })

  it('removes the error once the failed switch itself is toggled again', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      noGalleryPhotos,
      { status: 500, body: { error: 'Serverfehler' } },
      { body: { locks: { guestbook: true, memories: false, who_votes: false, gallery_upload: false } } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    await userEvent.click(screen.getByRole('switch', { name: /gästebuch/i }))
    await waitFor(() => expect(screen.getByText(/umschalten fehlgeschlagen/i)).toBeInTheDocument())
    await userEvent.click(screen.getByRole('switch', { name: /gästebuch/i }))

    await waitFor(() => expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'true'))
    expect(screen.queryByText(/umschalten fehlgeschlagen/i)).not.toBeInTheDocument()
  })

  it('keeps a switch busy until its own answer is there, even while another one is toggled', async () => {
    const fetchMock = mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos])
    fetchMock
      .mockReturnValueOnce(new Promise(() => {}))
      .mockReturnValueOnce(new Promise(() => {}))
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    await userEvent.click(screen.getByRole('switch', { name: /gästebuch/i }))
    await userEvent.click(screen.getByRole('switch', { name: /erinnerungen/i }))

    expect(screen.getByRole('switch', { name: /gästebuch/i })).toBeDisabled()
    expect(screen.getByRole('switch', { name: /erinnerungen/i })).toBeDisabled()
    expect(screen.getByRole('switch', { name: /wer-von-uns/i })).toBeEnabled()
  })

  it('toggling one feature does not change the display of the other two', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      noGalleryPhotos,
      { body: { locks: { guestbook: true, memories: false, who_votes: false } } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

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
      noGalleryPhotos,
      { status: 200, body: { success: true } },
    ])

    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /^gästebuch/i }))
    await userEvent.click(screen.getByRole('button', { name: /löschen.*Anna/i }))

    await waitFor(() => expect(screen.queryByText('Herzlichen Glückwunsch euch!')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/guestbook/1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('does not remove the entry if the server delete fails', async () => {
    mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [] } },
      noGalleryPhotos,
      { status: 500, body: { error: 'Serverfehler' } },
    ])

    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /^gästebuch/i }))
    await userEvent.click(screen.getByRole('button', { name: /löschen.*Anna/i }))

    await waitFor(() => expect(screen.getByText(/löschen fehlgeschlagen/i)).toBeInTheDocument())
    expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument()
  })

  it('shows an error and leaves the switches unchanged when toggling fails', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      noGalleryPhotos,
      { status: 500, body: { error: 'Serverfehler' } },
    ])

    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    const toggle = screen.getByRole('switch', { name: /gästebuch/i })
    await userEvent.click(toggle)

    await waitFor(() => expect(screen.getByText(/umschalten fehlgeschlagen/i)).toBeInTheDocument())
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('shows the current gallery mode and does not affect the three write-lock switches', async () => {
    const fetchMock = mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    expect(screen.getByRole('button', { name: /^öffentlich$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('switching the gallery mode does not change the write-lock switches', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      noGalleryPhotos,
      { body: { mode: 'password' } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    await userEvent.click(screen.getByRole('button', { name: /^kennwort$/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^kennwort$/i })).toHaveAttribute('aria-pressed', 'true')
    )
    expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: /erinnerungen/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: /wer-von-uns/i })).toHaveAttribute('aria-checked', 'false')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/gallery-mode',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ mode: 'password' }) })
    )
  })

  it('shows gallery photos and deletes one only after the server confirms', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { body: { photos: [annaPhoto] } },
      { status: 200, body: { success: true } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(screen.getByRole('img', { name: /foto von anna/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*anna/i }))

    await waitFor(() => expect(screen.queryByRole('img', { name: /foto von anna/i })).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/gallery/p1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('keeps the gallery photo visible if the server delete fails', async () => {
    mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { body: { photos: [annaPhoto] } },
      { status: 500, body: { error: 'Serverfehler' } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(screen.getByRole('img', { name: /foto von anna/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*anna/i }))

    await waitFor(() => expect(screen.getByText(/löschen fehlgeschlagen/i)).toBeInTheDocument())
    expect(screen.getByRole('img', { name: /foto von anna/i })).toBeInTheDocument()
  })

  it('shows the gallery delete error inside the gallery section, not only at the top of the page', async () => {
    mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { body: { photos: [annaPhoto] } },
      { status: 500, body: { error: 'Serverfehler' } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(screen.getByRole('img', { name: /foto von anna/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*anna/i }))

    const gallerySection = screen.getByRole('region', { name: /galerie/i })
    await waitFor(() => expect(within(gallerySection).getByText(/löschen fehlgeschlagen/i)).toBeInTheDocument())
  })

  it('asks for confirmation before deleting a gallery photo', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { body: { photos: [annaPhoto] } },
      { status: 200, body: { success: true } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(screen.getByRole('img', { name: /foto von anna/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*anna/i }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/anna/i))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/gallery/p1', expect.objectContaining({ method: 'DELETE' })))
  })

  it('does not delete a gallery photo when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { body: { photos: [annaPhoto] } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(screen.getByRole('img', { name: /foto von anna/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*anna/i }))

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('img', { name: /foto von anna/i })).toBeInTheDocument()
  })

  it('adds a photo uploaded through the admin form to the list', async () => {
    mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    const uploadStub = await screen.findByRole('button', { name: 'stub-upload' })
    expect(uploadStub).toHaveAttribute('data-admin', 'true')

    await userEvent.click(uploadStub)

    expect(await screen.findByRole('img', { name: /foto von saruga/i })).toBeInTheDocument()
  })

  it('labels each thumbnail with its category and marks official photos', async () => {
    mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { body: { photos: [annaPhoto, { ...annaPhoto, id: 'p2', uploaderName: 'Saruga', category: 'Party', isOfficial: true }] } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(screen.getByRole('img', { name: /foto von saruga/i })).toBeInTheDocument())

    const gallerySection = screen.getByRole('region', { name: /galerie/i })
    expect(within(gallerySection).getByText('Hochzeit')).toBeInTheDocument()
    expect(within(gallerySection).getByText('Party')).toBeInTheDocument()
    expect(within(gallerySection).getAllByText('Offiziell')).toHaveLength(1)
  })

  it('shows a fourth switch for the photo upload and sends gallery_upload when it is toggled', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      noGalleryPhotos,
      { body: { locks: { guestbook: false, memories: false, who_votes: false, gallery_upload: true } } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    const toggle = screen.getByRole('switch', { name: /foto-upload/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(toggle)

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/write-lock',
      expect.objectContaining({ body: JSON.stringify({ feature: 'gallery_upload', locked: true }) })
    )
    expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('starts with guestbook and memories collapsed and the gallery open', async () => {
    mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)

    expect(screen.getByRole('button', { name: /^gästebuch/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /^erinnerungen/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /^galerie \(/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('resets the memory record only after confirmation', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      noGalleryPhotos,
      { body: { record: null } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    await userEvent.click(screen.getByRole('button', { name: /memory-rekord zurücksetzen/i }))

    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/memory-record', expect.objectContaining({ method: 'DELETE' }))
    )
    expect(await screen.findByText(/rekord zurückgesetzt/i)).toBeInTheDocument()
  })

  it('does not reset the memory record when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const fetchMock = mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    await userEvent.click(screen.getByRole('button', { name: /memory-rekord zurücksetzen/i }))

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('shows an error when the memory record could not be reset', async () => {
    mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      noGalleryPhotos,
      { status: 500, body: { error: 'Serverfehler' } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await screen.findByRole('button', { name: /memory-rekord zurücksetzen/i })

    await userEvent.click(screen.getByRole('button', { name: /memory-rekord zurücksetzen/i }))

    expect(await screen.findByText(/zurücksetzen fehlgeschlagen/i)).toBeInTheDocument()
  })

  it('shows the current memory record in the reset card, so an implausible one is noticed', async () => {
    mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos], {
      memoryRecord: { moves: 8, seconds: 4 },
    })
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)

    expect(await screen.findByText(/aktueller rekord: 8 züge · 00:04/i)).toBeInTheDocument()
  })

  it('says so when there is no memory record yet', async () => {
    mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)

    expect(await screen.findByText(/noch kein rekord/i)).toBeInTheDocument()
  })

  it('shows "no record" again after the reset succeeded', async () => {
    mockFetchSequence(
      [{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos, { body: { record: null } }],
      { memoryRecord: { moves: 8, seconds: 4 } }
    )
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await screen.findByText(/aktueller rekord: 8 züge/i)

    await userEvent.click(screen.getByRole('button', { name: /memory-rekord zurücksetzen/i }))

    expect(await screen.findByText(/noch kein rekord/i)).toBeInTheDocument()
  })

  it('tells the admin to log in again when the session expired during the reset', async () => {
    mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      noGalleryPhotos,
      { status: 401, body: { error: 'Nicht angemeldet.' } },
    ])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
    await screen.findByRole('button', { name: /memory-rekord zurücksetzen/i })

    await userEvent.click(screen.getByRole('button', { name: /memory-rekord zurücksetzen/i }))

    expect(await screen.findByText(/sitzung abgelaufen/i)).toBeInTheDocument()
  })

  it('gives the reset button a comfortable touch target on a phone', async () => {
    mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos])
    render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)

    expect(await screen.findByRole('button', { name: /memory-rekord zurücksetzen/i })).toHaveClass('min-h-11')
  })

  it('tells the admin that a locked photo upload still works for them', async () => {
    mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos])
    render(
      <AdminDashboard
        initialLocks={{ ...noLocks, gallery_upload: true }}
        initialGalleryMode="public"
      />
    )

    expect(await screen.findByText(/gesperrt für gäste/i)).toBeInTheDocument()
    expect(screen.getByText(/du lädst weiter hoch/i)).toBeInTheDocument()
  })
})
