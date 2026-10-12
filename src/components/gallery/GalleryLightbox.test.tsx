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

  it('deletes the photo and calls onDeleted when the server confirms', async () => {
    saveDeleteToken('p1', 'secret-token')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)
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
})
