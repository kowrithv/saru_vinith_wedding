import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Vendors from './Vendors'
import { vendors } from '@/lib/vendors'

describe('Vendors', () => {
  it('thanks the service providers under its own heading', () => {
    render(<Vendors vendors={vendors} />)
    expect(screen.getByRole('heading', { name: /unsere dienstleister/i })).toBeInTheDocument()
    expect(screen.getByText(/danke/i)).toBeInTheDocument()
  })

  it('links every provider in a new tab without handing over the referrer', () => {
    render(<Vendors vendors={vendors} />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(vendors.length)
    links.forEach((link, index) => {
      expect(link).toHaveAttribute('href', vendors[index].href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(link.getAttribute('rel')).toContain('noreferrer')
    })
  })

  it('says where each link leads, in the accessible name too', () => {
    render(<Vendors vendors={vendors} />)
    expect(screen.getByRole('link', { name: /optimeye.*instagram/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /begegnungsstätte niederkrüchten.*website/i })).toBeInTheDocument()
  })

  it('names the role where it is known', () => {
    render(<Vendors vendors={vendors} />)
    expect(screen.getByText('Catering')).toBeInTheDocument()
    expect(screen.getByText('DJ')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
  })

  it('lists the names in one wrapping row instead of a card each', () => {
    const { container } = render(<Vendors vendors={vendors} />)
    expect(container.querySelector('ul')).toHaveClass('flex-wrap')
    screen.getAllByRole('link').forEach((link) => {
      expect(link.className).not.toMatch(/\bborder\b/)
      expect(link.className).not.toMatch(/\bbg-white\b/)
    })
  })

  it('shows nothing for an empty list', () => {
    const { container } = render(<Vendors vendors={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
