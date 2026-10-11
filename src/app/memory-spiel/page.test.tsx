import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MemorySpielPage from './page'

vi.mock('@/components/sections/MemoryGame', () => ({
  default: () => <div data-testid="memory-game-stub" />,
}))

describe('MemorySpielPage', () => {
  it('renders the memory game', () => {
    render(<MemorySpielPage />)
    expect(screen.getByTestId('memory-game-stub')).toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<MemorySpielPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })
})
