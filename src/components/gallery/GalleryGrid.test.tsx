import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import GalleryGrid from './GalleryGrid'
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
        photos={[photo({ id: 'p1', category: 'Standesamt' }), photo({ id: 'p2', category: 'Party' })]}
        onPhotoDeleted={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^party/i }))
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  describe('empty categories', () => {
    it('shows only the categories that have photos, plus "Alle"', () => {
      render(
        <GalleryGrid
          photos={[photo({ id: 'p1', category: 'Standesamt' }), photo({ id: 'p2', category: 'Party' })]}
          onPhotoDeleted={vi.fn()}
        />
      )

      expect(screen.getByRole('button', { name: /^alle/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^standesamt/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^party/i })).toBeInTheDocument()
      for (const empty of [/^kennenlernen/i, /^verlobung/i, /^erinnerungen/i]) {
        expect(screen.queryByRole('button', { name: empty })).not.toBeInTheDocument()
      }
    })

    it('keeps the categories in their usual order', () => {
      render(
        <GalleryGrid
          photos={[photo({ id: 'p1', category: 'Party' }), photo({ id: 'p2', category: 'Verlobung' })]}
          onPhotoDeleted={vi.fn()}
        />
      )

      // Die Foto-Kacheln sind auch Buttons: nur die Filter haben eine Anzahl am Ende.
      const chips = screen.getAllByRole('button').filter((button) => /\(\d+\)$/.test(button.textContent ?? ''))
      expect(chips.map((chip) => chip.textContent?.replace(/\s*\(\d+\)$/, ''))).toEqual(['Alle', 'Verlobung', 'Party'])
    })

    it('shows a category as soon as its first photo arrives', () => {
      const { rerender } = render(
        <GalleryGrid photos={[photo({ id: 'p1', category: 'Standesamt' })]} onPhotoDeleted={vi.fn()} />
      )
      expect(screen.queryByRole('button', { name: /^party/i })).not.toBeInTheDocument()

      rerender(
        <GalleryGrid
          photos={[photo({ id: 'p1', category: 'Standesamt' }), photo({ id: 'p2', category: 'Party' })]}
          onPhotoDeleted={vi.fn()}
        />
      )
      expect(screen.getByRole('button', { name: /^party/i })).toBeInTheDocument()
    })

    it('goes back to "Alle" when the last photo of the chosen category disappears', () => {
      const both = [photo({ id: 'p1', category: 'Standesamt' }), photo({ id: 'p2', category: 'Party' })]
      const { rerender } = render(<GalleryGrid photos={both} onPhotoDeleted={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /^party/i }))
      expect(screen.getAllByRole('img')).toHaveLength(1)

      rerender(<GalleryGrid photos={[both[0]]} onPhotoDeleted={vi.fn()} />)

      expect(screen.queryByRole('button', { name: /^party/i })).not.toBeInTheDocument()
      expect(screen.getAllByRole('img')).toHaveLength(1)
      expect(screen.getByRole('button', { name: /^alle/i })).toHaveClass('bg-dark-blue')
      expect(screen.queryByText(/keine fotos in dieser kategorie/i)).not.toBeInTheDocument()
    })
  })

  it('keeps the open photo when new photos arrive in front of it', async () => {
    const old = [photo({ id: 'p1', category: 'Party', uploaderName: 'Anna' }), photo({ id: 'p2', category: 'Party', uploaderName: 'Ben' })]
    const { rerender } = render(<GalleryGrid photos={old} onPhotoDeleted={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('img')[1])
    expect(await screen.findByText('2 / 2')).toBeInTheDocument()

    rerender(
      <GalleryGrid
        photos={[photo({ id: 'p0', category: 'Party', uploaderName: 'Neu' }), ...old]}
        onPhotoDeleted={vi.fn()}
      />
    )

    expect(await screen.findByText('3 / 3')).toBeInTheDocument()
    expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute('src', old[1].originalUrl)
  })

  it('closes the open photo when it is no longer in the list', async () => {
    const old = [photo({ id: 'p1', category: 'Party' }), photo({ id: 'p2', category: 'Party' })]
    const { rerender } = render(<GalleryGrid photos={old} onPhotoDeleted={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('img')[0])
    await screen.findByText('1 / 2')

    rerender(<GalleryGrid photos={[old[1]]} onPhotoDeleted={vi.fn()} />)

    await waitFor(() => expect(screen.queryByText(/ \/ /)).not.toBeInTheDocument())
  })

  it('opens the lightbox for the clicked photo within the filtered set', async () => {
    render(
      <GalleryGrid
        photos={[photo({ id: 'p1', category: 'Standesamt' }), photo({ id: 'p2', category: 'Party' })]}
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

  // Mosaik: ein dichtes Raster, das Zeile für Zeile gelesen wird (neueste zuerst); das neueste Foto
  // und danach jedes 7. ist doppelt so groß.
  describe('mosaic layout', () => {
    const many = (count: number, category = 'Party') =>
      Array.from({ length: count }, (_, i) =>
        photo({ id: `p${i}`, uploaderName: `Gast ${i}`, category, thumbUrl: `https://fotos.example.de/p${i}/thumb.jpg` })
      )
    const tiles = () => screen.getAllByRole('img').map((img) => img.closest('button') as HTMLButtonElement)
    const isBig = (tile: HTMLElement) => tile.classList.contains('col-span-2') && tile.classList.contains('row-span-2')
    const bigIndexes = () =>
      tiles()
        .map((tile, index) => (isBig(tile) ? index : -1))
        .filter((index) => index >= 0)

    it('lays the photos out as a dense grid read row by row, not in CSS columns', () => {
      render(<GalleryGrid photos={many(5)} onPhotoDeleted={vi.fn()} />)
      const grid = tiles()[0].parentElement
      expect(grid).toHaveClass('grid')
      expect(grid?.className).toContain('[grid-auto-flow:dense]')
      expect(grid?.className).not.toMatch(/\bcolumns-/)
    })

    it('makes the newest photo and then every 7th photo a large tile', () => {
      render(<GalleryGrid photos={many(15)} onPhotoDeleted={vi.fn()} />)
      expect(bigIndexes()).toEqual([0, 7, 14])
    })

    it('keeps the rhythm going when more photos are shown', () => {
      render(<GalleryGrid photos={many(70)} onPhotoDeleted={vi.fn()} />)
      expect(bigIndexes()).toEqual([0, 7, 14, 21, 28, 35, 42, 49, 56])
      fireEvent.click(screen.getByRole('button', { name: /10 weitere/i }))
      expect(bigIndexes()).toEqual([0, 7, 14, 21, 28, 35, 42, 49, 56, 63])
    })

    it('counts the rhythm within the chosen category', () => {
      const photos = [
        ...many(3, 'Standesamt').map((p, i) => ({ ...p, id: `s${i}` })),
        ...many(10, 'Party').map((p, i) => ({ ...p, id: `q${i}` })),
      ]
      render(<GalleryGrid photos={photos} onPhotoDeleted={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /^party/i }))
      expect(bigIndexes()).toEqual([0, 7])
    })

    it('keeps the photos in the order they were given, newest first', () => {
      render(<GalleryGrid photos={many(4)} onPhotoDeleted={vi.fn()} />)
      expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual([
        'Foto von Gast 0',
        'Foto von Gast 1',
        'Foto von Gast 2',
        'Foto von Gast 3',
      ])
    })

    it('crops every photo to fill its tile', () => {
      render(<GalleryGrid photos={many(2)} onPhotoDeleted={vi.fn()} />)
      for (const img of screen.getAllByRole('img')) expect(img).toHaveClass('h-full', 'w-full', 'object-cover')
    })

    it('never lets a long uploader name run out of its tile', () => {
      render(<GalleryGrid photos={[photo({ uploaderName: 'Alexandra-Marie von Hohenzollern-Sigmaringen' })]} onPhotoDeleted={vi.fn()} />)
      expect(screen.getByText(/von alexandra-marie/i)).toHaveClass('truncate', 'max-w-full')
    })
  })

  // Der Champagner-Filter muss auf dem hellen Hintergrund erkennbar sein
  // (Kante) und der aktive eine Goldkante tragen (Vorschlag C9).
  describe('filter chips', () => {
    const photos = [photo({ id: 'p1', category: 'Standesamt' }), photo({ id: 'p2', category: 'Party' })]

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

  // Am Fest kommen Tausende Fotos zusammen: die Liste wird stückweise gezeigt.
  describe('paging', () => {
    const many = (count: number, category = 'Party') =>
      Array.from({ length: count }, (_, i) => photo({ id: `p${i}`, category }))

    it('shows 60 photos first and offers the rest on request', () => {
      render(<GalleryGrid photos={many(130)} onPhotoDeleted={vi.fn()} />)
      expect(screen.getAllByRole('img')).toHaveLength(60)

      fireEvent.click(screen.getByRole('button', { name: /60 weitere/i }))
      expect(screen.getAllByRole('img')).toHaveLength(120)

      fireEvent.click(screen.getByRole('button', { name: /10 weitere/i }))
      expect(screen.getAllByRole('img')).toHaveLength(130)
      expect(screen.queryByRole('button', { name: /weitere/i })).not.toBeInTheDocument()
    })

    it('offers nothing for a short list', () => {
      render(<GalleryGrid photos={many(10)} onPhotoDeleted={vi.fn()} />)
      expect(screen.queryByRole('button', { name: /weitere/i })).not.toBeInTheDocument()
    })

    it('starts again with the first page when the category changes', () => {
      render(<GalleryGrid photos={many(130)} onPhotoDeleted={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /60 weitere/i }))
      expect(screen.getAllByRole('img')).toHaveLength(120)

      fireEvent.click(screen.getByRole('button', { name: /^alle/i }))
      expect(screen.getAllByRole('img')).toHaveLength(120)
      fireEvent.click(screen.getByRole('button', { name: /^party/i }))
      expect(screen.getAllByRole('img')).toHaveLength(60)
    })
  })
})
