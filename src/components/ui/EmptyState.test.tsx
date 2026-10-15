import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('shows the title and the explanation', () => {
    render(<EmptyState title="Noch keine Fotos" description="Lade das erste hoch." />)
    expect(screen.getByText('Noch keine Fotos')).toBeInTheDocument()
    expect(screen.getByText('Lade das erste hoch.')).toBeInTheDocument()
  })

  it('shows an action when one is given', () => {
    render(<EmptyState title="Leer" action={<a href="/gallery">Zur Galerie</a>} />)
    expect(screen.getByRole('link', { name: 'Zur Galerie' })).toBeInTheDocument()
  })

  it('works without description and action', () => {
    render(<EmptyState title="Nur ein Titel" />)
    expect(screen.getByText('Nur ein Titel')).toBeInTheDocument()
  })
})
