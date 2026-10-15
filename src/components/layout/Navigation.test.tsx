import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Navigation from './Navigation'

let mockPathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

describe('Navigation', () => {
  it('renders every navigation item as a link', () => {
    mockPathname = '/'
    render(<Navigation />)
    expect(screen.getAllByRole('link', { name: /Startseite/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Unsere Geschichte/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Hochzeitsinfos/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Galerie/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Quiz/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Gästespiel/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Erinnerungen/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Gästebuch/i }).length).toBeGreaterThan(0)
  })

  it('never renders a link to /admin', () => {
    mockPathname = '/'
    render(<Navigation />)
    const links = screen.getAllByRole('link')
    expect(links.some((link) => link.getAttribute('href') === '/admin')).toBe(false)
  })

  it('marks the current page as active', () => {
    mockPathname = '/story'
    render(<Navigation />)
    const storyLinks = screen.getAllByRole('link', { name: 'Unsere Geschichte' })
    expect(storyLinks[0]).toHaveClass('font-semibold')
  })

  it('opens the mobile menu on hamburger click and shows the links again', async () => {
    mockPathname = '/'
    render(<Navigation />)
    const toggle = screen.getByRole('button', { name: /Menü öffnen/i })
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: /Menü schließen/i })).toBeInTheDocument()
    // Jetzt gibt es die Links doppelt: Desktop-Leiste (hidden via CSS, aber im DOM) + mobiles Menü.
    expect(screen.getAllByRole('link', { name: 'Gästebuch' }).length).toBeGreaterThanOrEqual(2)
  })

  it('closes the mobile menu when the route changes', async () => {
    mockPathname = '/'
    const { rerender } = render(<Navigation />)
    const toggle = screen.getByRole('button', { name: /Menü öffnen/i })
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: /Menü schließen/i })).toBeInTheDocument()

    mockPathname = '/story'
    rerender(<Navigation />)
    expect(screen.getByRole('button', { name: /Menü öffnen/i })).toBeInTheDocument()
  })

  it('closes the mobile menu when a link inside it is clicked, even without a route change', async () => {
    mockPathname = '/'
    render(<Navigation />)
    const toggle = screen.getByRole('button', { name: /Menü öffnen/i })
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: /Menü schließen/i })).toBeInTheDocument()

    const mobileLink = screen.getAllByRole('link', { name: 'Gästebuch' })[1]
    await userEvent.click(mobileLink)
    expect(screen.getByRole('button', { name: /Menü öffnen/i })).toBeInTheDocument()
  })

  // Das Menü ist dunkelblau: dort liest sich das helle Gold (nicht das
  // Text-Gold für weiße Flächen).
  it('shows the hashtag in the mobile menu in a gold that is readable on dark blue', async () => {
    mockPathname = '/'
    render(<Navigation />)
    await userEvent.click(screen.getByRole('button', { name: /Menü öffnen/i }))

    const hashtags = screen.getAllByText(/^#/)
    expect(hashtags.some((el) => el.classList.contains('text-gold'))).toBe(true)
  })

  it('opens the mobile menu as a dark blue full screen with the names of the couple', async () => {
    mockPathname = '/'
    render(<Navigation />)
    await userEvent.click(screen.getByRole('button', { name: /Menü öffnen/i }))

    const names = screen.getAllByText('Saruga & Vinith')
    const panel = names[0].closest('div.fixed')
    expect(panel).toHaveClass('bg-dark-blue', 'inset-0')
  })
})
