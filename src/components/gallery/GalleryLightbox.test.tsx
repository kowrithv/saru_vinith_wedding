import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import GalleryLightbox from './GalleryLightbox'
import { saveDeleteToken } from '@/lib/gallery-delete-tokens'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'

function photo(overrides: Partial<GalleryPhotoView> = {}): GalleryPhotoView {
  return {
    id: 'p1',
    uploaderName: 'Anna',
    category: 'Standesamt',
    isOfficial: false,
    createdAt: '2026-10-12T10:00:00.000Z',
    thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
    originalUrl: 'https://fotos.example.de/p1/original.jpg',
    ...overrides,
  }
}

describe('GalleryLightbox', () => {
  afterEach(() => {
    window.localStorage.clear()
    cleanup()
  })

  it('does not show a delete button when there is no saved token for this photo', () => {
    render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    expect(screen.queryByRole('button', { name: /löschen/i })).not.toBeInTheDocument()
  })

  it('shows a delete button when a saved token exists for this photo', () => {
    saveDeleteToken('p1', 'secret-token')
    render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /löschen/i })).toBeInTheDocument()
  })

  it('does not show a delete button when a token exists only for a different photo', () => {
    saveDeleteToken('p2', 'token-for-p2')
    render(
      <GalleryLightbox photos={[photo({ id: 'p1' })]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    expect(screen.queryByRole('button', { name: /löschen/i })).not.toBeInTheDocument()
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={onClose} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigates to the next photo, wrapping around to the first', () => {
    const onNavigate = vi.fn()
    render(
      <GalleryLightbox
        photos={[photo({ id: 'p1' }), photo({ id: 'p2' })]}
        index={1}
        onClose={vi.fn()}
        onNavigate={onNavigate}
        onDeleted={vi.fn()}
      />
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('navigates to the previous photo', () => {
    const onNavigate = vi.fn()
    render(
      <GalleryLightbox
        photos={[photo({ id: 'p1' }), photo({ id: 'p2' })]}
        index={1}
        onClose={vi.fn()}
        onNavigate={onNavigate}
        onDeleted={vi.fn()}
      />
    )
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('stops reacting to keyboard events after being unmounted', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={onClose} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('deletes the photo and calls onDeleted when confirmed and the server confirms', async () => {
    saveDeleteToken('p1', 'secret-token')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))
    const onDeleted = vi.fn()

    render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={onDeleted} />
    )
    fireEvent.click(screen.getByRole('button', { name: /löschen/i }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('p1'))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/gallery/p1',
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ deleteToken: 'secret-token' }) })
    )
    vi.unstubAllGlobals()
  })

  it('does not delete when the confirmation is declined', () => {
    saveDeleteToken('p1', 'secret-token')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => false))

    render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /löschen/i }))

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('locks body scroll while mounted and restores it on unmount', () => {
    const { unmount } = render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('moves focus into the dialog on mount and returns it to the trigger on close', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    expect(document.activeElement).toBe(screen.getByRole('dialog'))

    unmount()

    expect(document.activeElement).toBe(trigger)
    document.body.removeChild(trigger)
  })

  it('falls back to the thumbnail when the original fails to load', () => {
    render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    const img = screen.getByRole('img', { name: /foto von anna/i })
    expect(img).toHaveAttribute('src', 'https://fotos.example.de/p1/original.jpg')
    fireEvent.error(img)
    expect(img).toHaveAttribute('src', 'https://fotos.example.de/p1/thumb.jpg')
  })

  it('downloads the original via a same-origin blob instead of a cross-origin link', async () => {
    const blob = new Blob(['fake-image-data'])
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /original herunterladen/i }))

    // Eigene Adresse für den CORS-Aufruf: die <img>-Anfrage derselben Datei läge sonst
    // ohne CORS-Kopf im Cache (Cloudflare und Browser) und der Abruf würde blockiert.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('https://fotos.example.de/p1/original.jpg?cors=1', { mode: 'cors' })
    )
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Großansicht wie im Vorschlag C10: eine dunkle Karte mit dem Foto, darunter
  // links Name sowie Kategorie und Uhrzeit, rechts der goldene Knopf.
  describe('card layout', () => {
    function renderLightbox(overrides: Partial<GalleryPhotoView> = {}) {
      return render(
        <GalleryLightbox
          photos={[photo(overrides)]}
          index={0}
          onClose={() => {}}
          onNavigate={() => {}}
          onDeleted={() => {}}
        />
      )
    }

    it('shows the photo on a dark rounded card', () => {
      renderLightbox()
      const card = screen.getByTestId('lightbox-card')
      expect(card).toHaveClass('rounded-2xl')
      expect(card).toContainElement(screen.getByRole('img', { name: /foto von anna/i }))
    })

    it('names the uploader first and puts category and time on a second, quieter line', () => {
      renderLightbox()
      const info = screen.getByTestId('lightbox-info')
      expect(within(info).getByText('Von Anna')).toHaveClass('font-semibold')
      const detail = within(info).getByText('Standesamt').parentElement as HTMLElement
      expect(detail).toHaveTextContent('12.10. um 12:00 Uhr')
      expect(detail).toHaveClass('text-xs')
    })

    it('puts the gold download button in the same row as the name', () => {
      renderLightbox()
      const info = screen.getByTestId('lightbox-info')
      const button = within(info).getByRole('button', { name: /original herunterladen/i })
      expect(button).toHaveClass('bg-gold')
    })

    it('offers deleting only on own photos, as a line under the card content', () => {
      renderLightbox()
      expect(screen.queryByText(/das ist dein foto/i)).not.toBeInTheDocument()
      cleanup()

      saveDeleteToken('p1', 'secret-token')
      renderLightbox()
      const line = screen.getByText(/das ist dein foto/i).closest('p') as HTMLElement
      expect(within(line).getByRole('button', { name: /löschen/i })).toBeInTheDocument()
    })

    it('shows the position within the shown photos', () => {
      render(
        <GalleryLightbox
          photos={[photo({ id: 'p1' }), photo({ id: 'p2' })]}
          index={1}
          onClose={() => {}}
          onNavigate={() => {}}
          onDeleted={() => {}}
        />
      )
      expect(screen.getByText('2 / 2')).toBeInTheDocument()
    })
  })
})
