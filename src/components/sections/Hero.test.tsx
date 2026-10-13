import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import Hero from './Hero'
import { couple } from '@/lib/site-content'
import { receptionEvent } from '@/lib/event-info'

describe('Hero', () => {
  it('renders both names and the hashtag', () => {
    render(<Hero />)
    expect(screen.getByText(couple.bride)).toBeInTheDocument()
    expect(screen.getByText(couple.groom)).toBeInTheDocument()
    expect(screen.getByText(couple.hashtag)).toBeInTheDocument()
  })

  it('renders the reception date and venue', () => {
    render(<Hero />)
    expect(screen.getByText(receptionEvent.displayDate)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(receptionEvent.venue))).toBeInTheDocument()
  })

  it('links to Info and Story as real navigation links, not nested buttons', () => {
    render(<Hero />)
    const infoLink = screen.getByRole('link', { name: /hochzeitsinfos/i })
    const storyLink = screen.getByRole('link', { name: /unsere geschichte/i })
    expect(infoLink).toHaveAttribute('href', '/info')
    expect(storyLink).toHaveAttribute('href', '/story')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('has a single h1 that contains both names', () => {
    render(<Hero />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent(new RegExp(`${couple.bride}.*${couple.groom}`))
  })

  it('is visible in the server HTML: no content is hidden by inline styles until JavaScript runs', () => {
    const html = renderToString(<Hero />)
    expect(html).not.toMatch(/opacity:\s*0/)
    expect(html).toContain(couple.bride)
  })

  it('switches its entrance animation off for visitors who prefer reduced motion', () => {
    const html = renderToString(<Hero />)
    expect(html).toContain('motion-reduce:animate-none')
  })

  it('brings its own offset below the fixed navigation and measures its height in svh', () => {
    const { container } = render(<Hero />)
    const section = container.firstElementChild
    expect(section).toHaveClass('pt-20', 'pb-24', 'min-h-svh')
  })

  it('makes the "Mehr entdecken" hint a link that scrolls to the countdown section', () => {
    render(<Hero />)
    expect(screen.getByRole('link', { name: /mehr entdecken/i })).toHaveAttribute('href', '#countdown')
  })
})
