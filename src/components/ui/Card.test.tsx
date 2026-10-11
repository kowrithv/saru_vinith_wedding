import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Card from './Card'

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>Inhalt der Karte</Card>)
    expect(screen.getByText('Inhalt der Karte')).toBeInTheDocument()
  })

  it('applies the dark variant background class', () => {
    render(<Card variant="dark">Dunkle Karte</Card>)
    expect(screen.getByText('Dunkle Karte')).toHaveClass('bg-dark-blue')
  })

  it('applies the default variant background class when no variant is given', () => {
    render(<Card>Standardkarte</Card>)
    expect(screen.getByText('Standardkarte')).toHaveClass('bg-white')
  })
})
