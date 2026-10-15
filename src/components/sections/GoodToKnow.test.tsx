import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import GoodToKnow from './GoodToKnow'

describe('GoodToKnow', () => {
  it('shows each hint with its title and text', () => {
    render(
      <GoodToKnow
        items={[
          { title: 'Kleidung', text: 'Festlich, gern mit Farbe.' },
          { title: 'Kinder', text: 'Sind herzlich willkommen.' },
        ]}
      />
    )
    expect(screen.getByRole('heading', { name: /gut zu wissen/i })).toBeInTheDocument()
    expect(screen.getByText('Kleidung')).toBeInTheDocument()
    expect(screen.getByText('Sind herzlich willkommen.')).toBeInTheDocument()
  })

  // Ohne Inhalte soll nichts Halbfertiges auf der Seite stehen.
  it('renders nothing while there are no hints', () => {
    const { container } = render(<GoodToKnow items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
