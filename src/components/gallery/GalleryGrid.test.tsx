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

  it('shows the uploader badge without requiring hover (no opacity-0 gate, invisible on touch devices)', () => {
    render(<GalleryGrid photos={[photo()]} onPhotoDeleted={vi.fn()} />)
    const badge = screen.getByText(/von anna/i)
    expect(badge.closest('div')).not.toHaveClass('opacity-0')
  })

  it('lazy-loads grid thumbnails', () => {
    render(<GalleryGrid photos={[photo()]} onPhotoDeleted={vi.fn()} />)
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy')
  })

  // Der Champagner-Filter muss auf dem hellen Hintergrund erkennbar sein
  // (Kante) und der aktive eine Goldkante tragen (Vorschlag C9).
  describe('filter chips', () => {
    const photos = [photo({ id: 'p1', category: 'Hochzeit' }), photo({ id: 'p2', category: 'Party' })]

    it('draws the inactive chips in champagne with a visible edge', () => {
      render(<GalleryGrid photos={photos} onPhotoDeleted={vi.fn()} />)
      const chip = screen.getByRole('button', { name: /^party/i })
      expect(chip).toHaveClass('bg-champagne', 'border', 'border-champagne-dark', 'text-dark-blue')
    })

    it('marks the active chip in navy with a gold underline', () => {
      render(<GalleryGrid photos={photos} onPhotoDeleted={vi.fn()} />)
      const active = screen.getByRole('button', { name: /^alle/i })
      expect(active).toHaveClass('bg-dark-blue', 'text-white')
      expect(active.className).toContain('shadow-[inset_0_-3px_0_var(--color-gold)]')

      fireEvent.click(screen.getByRole('button', { name: /^party/i }))
      expect(screen.getByRole('button', { name: /^party/i }).className).toContain('shadow-[inset_0_-3px_0_var(--color-gold)]')
      expect(screen.getByRole('button', { name: /^alle/i }).className).not.toContain('inset_0_-3px')
    })

    // Zwei Schatten-Klassen setzen dieselbe Variable: im Stylesheet gewinnt
    // die später definierte, und die Goldkante verschwand.
    it('never combines the underline with a second shadow utility', () => {
      render(<GalleryGrid photos={photos} onPhotoDeleted={vi.fn()} />)
      const active = screen.getByRole('button', { name: /^alle/i })
      expect(active.className).not.toMatch(/\bshadow-(sm|md|lg|xl)\b/)
    })

    it('shows the category counts', () => {
      render(<GalleryGrid photos={photos} onPhotoDeleted={vi.fn()} />)
      expect(screen.getByRole('button', { name: /^alle/i })).toHaveTextContent('(2)')
      expect(screen.getByRole('button', { name: /^party/i })).toHaveTextContent('(1)')
    })
  })
})
