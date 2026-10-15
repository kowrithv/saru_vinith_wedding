import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MemorySpielPage from './page'
import { memoryImages } from '@/lib/memory-content'

vi.mock('@/components/sections/MemoryGameClient', () => ({
  default: () => <div data-testid="memory-game-stub" />,
}))

describe('MemorySpielPage', () => {
  it('renders the memory game', () => {
    render(<MemorySpielPage />)
    expect(screen.getByTestId('memory-game-stub')).toBeInTheDocument()
  })

  // Die Bilder werden mit dem HTML angekündigt, noch bevor das Spiel-Skript
  // geladen ist (das Brett entsteht erst im Browser).
  it('lets the browser fetch every game image right away', () => {
    render(<MemorySpielPage />)
    // React setzt Link-Hinweise je nach Art in den Kopf oder an Ort und Stelle.
    const hints = [...document.querySelectorAll('link[rel="prefetch"][as="image"]')].map((link) =>
      link.getAttribute('href')
    )
    expect(hints).toEqual(memoryImages)
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<MemorySpielPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })
})
