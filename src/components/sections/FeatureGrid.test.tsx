import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import FeatureGrid from './FeatureGrid'
import { homeFeatures } from '@/lib/home-content'
import { navigationItems } from '@/lib/site-content'
import { homePreviewPhotos } from '@/lib/site-images'

describe('FeatureGrid', () => {
  it('renders every feature as a link to its real route', () => {
    render(<FeatureGrid />)
    homeFeatures.forEach((feature) => {
      const link = screen.getByRole('link', { name: new RegExp(feature.title) })
      expect(link).toHaveAttribute('href', feature.href)
    })
  })

  it('only links to pages that exist in the app', () => {
    homeFeatures.forEach((feature) => {
      const pageFile = path.join(process.cwd(), 'src/app', feature.href, 'page.tsx')
      expect(existsSync(pageFile), `${feature.href} hat keine page.tsx`).toBe(true)
    })
  })

  it('offers exactly the pages of the main navigation (without the home page itself)', () => {
    const navigationHrefs = navigationItems.map((item) => item.href).filter((href) => href !== '/')
    expect(homeFeatures.map((feature) => feature.href).sort()).toEqual([...navigationHrefs].sort())
  })

  it('advertises the shared record instead of a personal best on the memory tile', () => {
    const memory = homeFeatures.find((feature) => feature.href === '/memory-spiel')
    expect(memory?.description).toMatch(/rekord aller gäste/i)
  })

  // Gäste suchen zuerst Infos und Fotos: zwei große Kacheln führen, die übrigen
  // stehen darunter als kompakte Kacheln in zwei Spalten (Vorschlag C4).
  describe('ranking', () => {
    it('puts the information and the gallery first as large tiles', () => {
      render(<FeatureGrid />)
      const links = screen.getAllByRole('link')
      expect(links[0]).toHaveAttribute('href', '/info')
      expect(links[1]).toHaveAttribute('href', '/gallery')
      expect(links[0].firstElementChild).toHaveClass('bg-dark-blue', 'text-white')
      expect(links[1].firstElementChild).toHaveClass('bg-champagne')
    })

    it('labels the large tiles with a small eyebrow above the title', () => {
      render(<FeatureGrid />)
      expect(screen.getByText('Wichtig')).toBeInTheDocument()
      const info = screen.getAllByRole('link')[0]
      expect(info.querySelector('h3')).toHaveTextContent('Hochzeitsinfos')
    })

    it('shows the description on the large tiles at every screen size', () => {
      render(<FeatureGrid />)
      homeFeatures
        .filter((feature) => feature.featured)
        .forEach((feature) => {
          expect(screen.getByText(feature.description)).not.toHaveClass('hidden')
        })
    })

    it('shows four small photos of the couple on the photo tile', () => {
      render(<FeatureGrid />)
      const gallery = screen.getAllByRole('link')[1]
      const previews = gallery.querySelector('[data-testid="gallery-previews"]')
      expect(previews).toHaveAttribute('aria-hidden', 'true')
      const images = [...(previews?.querySelectorAll('img') ?? [])]
      expect(images.map((image) => image.getAttribute('src'))).toEqual(homePreviewPhotos)
      images.forEach((image) => expect(image).toHaveAttribute('alt', ''))
    })

    it('keeps the other tiles compact: two columns, description only from sm upwards', () => {
      render(<FeatureGrid />)
      homeFeatures
        .filter((feature) => !feature.featured)
        .forEach((feature) => {
          expect(screen.getByText(feature.description)).toHaveClass('hidden', 'sm:block')
          const tile = screen.getByRole('link', { name: new RegExp(feature.title) }).firstElementChild
          expect(tile).toHaveClass('bg-white')
        })
      expect(screen.getByTestId('feature-grid-small')).toHaveClass('grid-cols-2')
    })

    it('marks the icon of a compact tile with the bordeaux arch', () => {
      render(<FeatureGrid />)
      const small = homeFeatures.find((feature) => !feature.featured)!
      const tile = screen.getByRole('link', { name: new RegExp(small.title) })
      const arch = tile.querySelector('.bg-bordeaux')
      expect(arch).not.toBeNull()
      expect(arch).toHaveClass('rounded-t-full')
    })

    it('lets an odd last compact tile span both columns instead of leaving a gap', () => {
      render(<FeatureGrid />)
      const smallCount = homeFeatures.filter((feature) => !feature.featured).length
      const links = screen.getByTestId('feature-grid-small').children
      expect(links).toHaveLength(smallCount)
      const last = links[links.length - 1]
      if (smallCount % 2 === 1) {
        expect(last).toHaveClass('col-span-2')
      } else {
        expect(last).not.toHaveClass('col-span-2')
      }
    })
  })

  it('keeps the title visible on every screen size', () => {
    render(<FeatureGrid />)
    homeFeatures.forEach((feature) => {
      expect(screen.getByText(feature.title)).not.toHaveClass('hidden')
    })
  })
})
