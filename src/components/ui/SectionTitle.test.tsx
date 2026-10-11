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

  it('renders the subtitle when provided', () => {
    render(<SectionTitle title="Titel" subtitle="Ein Untertitel" />)
    expect(screen.getByText('Ein Untertitel')).toBeInTheDocument()
  })

  it('renders without a subtitle when none is provided', () => {
    render(<SectionTitle title="Titel" />)
    expect(screen.queryByText('Ein Untertitel')).not.toBeInTheDocument()
  })
})
