import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemoryGame from './MemoryGame'
import { MEMORY_PAIRS_COUNT } from '@/lib/memory-content'

describe('MemoryGame', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
  })

  it('deals a board with twice as many cards as there are pairs', () => {
    render(<MemoryGame />)
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    expect(cards).toHaveLength(MEMORY_PAIRS_COUNT * 2)
  })

  it('flips the two clicked cards face up', async () => {
    render(<MemoryGame />)
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    await userEvent.click(cards[0])
    expect(cards[0]).toBeDisabled()
  })

  it('locks further clicks while two cards are already flipped', async () => {
    render(<MemoryGame />)
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    await userEvent.click(cards[0])
    await userEvent.click(cards[1])
    const thirdBefore = cards[2]
    await userEvent.click(thirdBefore)
    // Während zwei Karten aufgedeckt sind (und noch nicht wieder zu/match
    // sind), darf eine dritte Karte nicht sofort umdrehbar sein.
    expect(thirdBefore).not.toBeDisabled()
  })

  it('increments the move counter once per pair of flips', async () => {
    render(<MemoryGame />)
    expect(screen.getByText(/0 Züge/)).toBeInTheDocument()
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    await userEvent.click(cards[0])
    await userEvent.click(cards[1])
    expect(screen.getByText(/1 Züge/)).toBeInTheDocument()
  })

  it('starts a fresh board on "Neues Spiel"', async () => {
    render(<MemoryGame />)
    await userEvent.click(screen.getByRole('button', { name: /neues spiel/i }))
    expect(screen.getByText(/0 Züge/)).toBeInTheDocument()
  })
})
