import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SectionTitle from './SectionTitle'

describe('SectionTitle', () => {
  it('renders the title as a level-2 heading', () => {
    render(<SectionTitle title="Unsere Geschichte" />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Unsere Geschichte' })
    ).toBeInTheDocument()
  })

  it('has the lotus as its ornament, in gold on light and soft white on dark backgrounds', () => {
    const { container, rerender } = render(<SectionTitle title="Titel" />)
    expect(container.querySelector('svg')).toHaveClass('text-gold')

    rerender(<SectionTitle title="Titel" light />)
    expect(container.querySelector('svg')).toHaveClass('text-white/60')
  })

  it('renders the subtitle when provided', () => {
    render(<SectionTitle title="Titel" subtitle="Ein Untertitel" />)
    expect(screen.getByText('Ein Untertitel')).toBeInTheDocument()
  })

  it('renders without a subtitle when none is provided', () => {
    render(<SectionTitle title="Titel" />)
    expect(screen.queryByText('Ein Untertitel')).not.toBeInTheDocument()
  })
})
