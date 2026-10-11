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

  it('renders every navigation item as a link', () => {
    render(<Footer />)
    expect(screen.getByRole('link', { name: 'Unsere Geschichte' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gästebuch' })).toBeInTheDocument()
  })

  it('never renders a link to /admin', () => {
    render(<Footer />)
    const links = screen.getAllByRole('link')
    expect(links.some((link) => link.getAttribute('href') === '/admin')).toBe(false)
  })
})
