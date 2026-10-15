import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import GalleryLightbox from './GalleryLightbox'
import { saveDeleteToken } from '@/lib/gallery-delete-tokens'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'

function photo(overrides: Partial<GalleryPhotoView> = {}): GalleryPhotoView {
  return {
    id: 'p1',
    uploaderName: 'Anna',
    category: 'Hochzeit',
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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('https://fotos.example.de/p1/original.jpg'))
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('captions the photo with the uploader, the category and the time it was taken', () => {
    render(<GalleryLightbox photos={[photo()]} index={0} onClose={() => {}} onNavigate={() => {}} onDeleted={() => {}} />)

    const caption = screen.getByText(/von anna/i).closest('p') as HTMLElement
    expect(caption).toHaveTextContent('Hochzeit')
    expect(caption).toHaveTextContent('12.10. um 12:00 Uhr')
  })
})
