import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
