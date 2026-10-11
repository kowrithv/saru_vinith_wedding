import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'

describe('HomePage', () => {
  it('renders the couple names as the main heading', () => {
    render(<HomePage />)
    expect(
      screen.getByRole('heading', { level: 1, name: /saruga.*vinith/i })
    ).toBeInTheDocument()
  })

  it('does not render its own <main> - the root layout owns that landmark', () => {
    const { container } = render(<HomePage />)
    expect(container.querySelector('main')).not.toBeInTheDocument()
  })
})
