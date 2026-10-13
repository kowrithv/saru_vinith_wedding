import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import FeatureGrid from './FeatureGrid'
import { homeFeatures } from '@/lib/home-content'
import { navigationItems } from '@/lib/site-content'

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

  it('advertises the shared record instead of a personal best on the memory tile', () => {
    const memory = homeFeatures.find((feature) => feature.href === '/memory-spiel')
    expect(memory?.description).toMatch(/rekord aller gäste/i)
  })
})
