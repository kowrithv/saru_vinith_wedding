import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import GalleryGrid from './GalleryGrid'
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

describe('GalleryGrid', () => {
  afterEach(() => cleanup())

  it('shows an empty-state message when there are no photos at all', () => {
    render(<GalleryGrid photos={[]} onPhotoDeleted={vi.fn()} />)
    expect(screen.getByText(/noch keine fotos/i)).toBeInTheDocument()
  })

  it('renders a thumbnail for every photo', () => {
    render(<GalleryGrid photos={[photo({ id: 'p1' }), photo({ id: 'p2' })]} onPhotoDeleted={vi.fn()} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('filters the grid by category when a chip is clicked', () => {
    render(
      <GalleryGrid
        photos={[photo({ id: 'p1', category: 'Hochzeit' }), photo({ id: 'p2', category: 'Party' })]}
        onPhotoDeleted={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^party/i }))
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('shows a category-specific empty state when the active category has no photos', () => {
    render(<GalleryGrid photos={[photo({ id: 'p1', category: 'Hochzeit' })]} onPhotoDeleted={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^party/i }))
    expect(screen.getByText(/keine fotos in dieser kategorie/i)).toBeInTheDocument()
  })

  it('opens the lightbox for the clicked photo within the filtered set', async () => {
    render(
      <GalleryGrid
        photos={[photo({ id: 'p1', category: 'Hochzeit' }), photo({ id: 'p2', category: 'Party' })]}
        onPhotoDeleted={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^party/i }))
    fireEvent.click(screen.getByRole('img', { name: /foto von anna/i }))
    expect(await screen.findByText('1 / 1')).toBeInTheDocument()
  })

  it('removes a deleted photo from the grid once the parent re-renders without it', () => {
    const { rerender } = render(
      <GalleryGrid photos={[photo({ id: 'p1' }), photo({ id: 'p2' })]} onPhotoDeleted={vi.fn()} />
    )
    rerender(<GalleryGrid photos={[photo({ id: 'p2' })]} onPhotoDeleted={vi.fn()} />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })
})
