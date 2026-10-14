import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from './Footer'

describe('Footer', () => {
  it('renders the combined couple name', () => {
    render(<Footer />)
    expect(screen.getByText('Saruga & Vinith')).toBeInTheDocument()
  })

  it('renders the reception date', () => {
    render(<Footer />)
    expect(screen.getByText(/17\. Oktober 2026/)).toBeInTheDocument()
  })

  // Die obere Navigation führt schon zu allen Seiten: der Footer wiederholt sie nicht.
  it('does not repeat the site navigation', () => {
    render(<Footer />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Unsere Geschichte' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Gästebuch' })).not.toBeInTheDocument()
    expect(screen.queryByText('Weitere Seiten')).not.toBeInTheDocument()
  })

  it('never renders a link to /admin', () => {
    render(<Footer />)
    const links = screen.queryAllByRole('link')
    expect(links.some((link) => link.getAttribute('href') === '/admin')).toBe(false)
  })
})
