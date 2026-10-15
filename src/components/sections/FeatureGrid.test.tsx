import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import FeatureGrid from './FeatureGrid'
import { homeFeatures } from '@/lib/home-content'
import { navigationItems } from '@/lib/site-content'

describe('FeatureGrid (ranking)', () => {
  // Gäste suchen zuerst Infos und Fotos: diese beiden Kacheln führen.
  it('puts the information and the gallery first and shows them as featured tiles', () => {
    render(<FeatureGrid />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/info')
    expect(links[1]).toHaveAttribute('href', '/gallery')
    expect(links[0].firstElementChild).toHaveClass('bg-dark-blue')
    expect(links[1].firstElementChild).toHaveClass('bg-dark-blue')
    expect(links[2].firstElementChild).not.toHaveClass('bg-dark-blue')
  })
})

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

  it('gives every tile its own action text instead of the same "Mehr erfahren"', () => {
    const ctas = homeFeatures.map((feature) => feature.cta)
    expect(new Set(ctas).size).toBe(homeFeatures.length)
    expect(ctas).not.toContain('Mehr erfahren')

    render(<FeatureGrid />)
    homeFeatures.forEach((feature) => {
      expect(screen.getByText(feature.cta)).toBeInTheDocument()
    })
  })

  it('turns the tiles into compact rows on small screens by hiding the description below sm', () => {
    render(<FeatureGrid />)

    homeFeatures.forEach((feature) => {
      expect(screen.getByText(feature.description)).toHaveClass('hidden', 'sm:block')
      const card = screen.getByRole('link', { name: new RegExp(feature.title) }).firstElementChild
      expect(card).toHaveClass('flex', 'sm:block')
    })
  })

  it('keeps the action text and the title visible on every screen size', () => {
    render(<FeatureGrid />)

    homeFeatures.forEach((feature) => {
      expect(screen.getByText(feature.title)).not.toHaveClass('hidden')
      expect(screen.getByText(feature.cta).parentElement).not.toHaveClass('hidden')
    })
  })

  it('advertises the shared record instead of a personal best on the memory tile', () => {
    const memory = homeFeatures.find((feature) => feature.href === '/memory-spiel')
    expect(memory?.description).toMatch(/rekord aller gäste/i)
  })
})
