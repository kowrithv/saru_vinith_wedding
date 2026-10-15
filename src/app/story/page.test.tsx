import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StoryPage from './page'
import { storyTimeline } from '@/lib/story-content'

describe('StoryPage', () => {
  it('renders every timeline entry in data order with its year and title', () => {
    render(<StoryPage />)
    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings).toHaveLength(storyTimeline.length)
    headings.forEach((heading, index) => {
      expect(heading).toHaveTextContent(storyTimeline[index].title)
    })
    storyTimeline.forEach((item) => {
      expect(screen.getByText(item.year)).toBeInTheDocument()
    })
  })

  it('renders the closing message', () => {
    render(<StoryPage />)
    expect(screen.getByText('Das Beste kommt noch')).toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<StoryPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })

  it('shows the year as the big number next to the exact date', () => {
    render(<StoryPage />)
    const first = storyTimeline[0]
    const bigYear = first.year.slice(-4)
    expect(screen.getAllByText(bigYear)[0]).toHaveClass('font-display', 'text-6xl')
    expect(screen.getByText(first.year)).toBeInTheDocument()
  })

  it('shortens long texts and expands them on request', async () => {
    render(<StoryPage />)
    const buttons = screen.getAllByRole('button', { name: /weiterlesen/i })
    expect(buttons).toHaveLength(storyTimeline.length)
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(storyTimeline[0].description)).toHaveClass('line-clamp-4')

    await userEvent.click(buttons[0])

    expect(screen.getByRole('button', { name: /weniger anzeigen/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(storyTimeline[0].description)).not.toHaveClass('line-clamp-4')
  })

  it('leads from the closing card to the memories page', () => {
    render(<StoryPage />)
    expect(screen.getByRole('link', { name: /erinnerung teilen/i })).toHaveAttribute('href', '/memories')
  })
})
