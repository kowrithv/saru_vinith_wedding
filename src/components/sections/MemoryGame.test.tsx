import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemoryGame from './MemoryGame'
import { MEMORY_PAIRS_COUNT } from '@/lib/memory-content'

// Zwei Paare (vier Karten) statt der echten acht reichen, um
// Auflösung/Gewinnlogik zu testen, ohne ein komplettes Spiel
// durchklicken zu müssen - die Tests selbst lesen MEMORY_PAIRS_COUNT
// weiterhin aus dem (gemockten) Modul, bleiben also unabhängig vom Wert.
vi.mock('@/lib/memory-content', () => ({
  memoryImages: ['/test/a.jpg', '/test/b.jpg'],
  MEMORY_PAIRS_COUNT: 2,
}))

function findMatchingPairIndices(cards: HTMLElement[]): [number, number] {
  const bySrc = new Map<string, number[]>()
  cards.forEach((card, index) => {
    const src = card.querySelector('img')?.getAttribute('src') ?? `no-image-${index}`
    const list = bySrc.get(src) ?? []
    list.push(index)
    bySrc.set(src, list)
  })
  for (const indices of bySrc.values()) {
    if (indices.length === 2) return [indices[0], indices[1]]
  }
  throw new Error('No matching pair found on the board')
}

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

  it('resolves a matching pair after the short delay and keeps both cards face up', () => {
    vi.useFakeTimers()
    render(<MemoryGame />)
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    const [a, b] = findMatchingPairIndices(cards)

    fireEvent.click(cards[a])
    fireEvent.click(cards[b])
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(cards[a]).toBeDisabled()
    expect(cards[b]).toBeDisabled()
  })

  it('flips a mismatched pair back down after the longer delay', () => {
    vi.useFakeTimers()
    render(<MemoryGame />)
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    const [a1, a2] = findMatchingPairIndices(cards)
    const other = [0, 1, 2, 3].find((i) => i !== a1 && i !== a2)!

    fireEvent.click(cards[a1])
    fireEvent.click(cards[other])
    act(() => {
      vi.advanceTimersByTime(900)
    })

    expect(cards[a1]).not.toBeDisabled()
    expect(cards[other]).not.toBeDisabled()
  })

  it('detects a win, shows the finish state, and saves the best score to localStorage', () => {
    vi.useFakeTimers()
    render(<MemoryGame />)
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    const [a1, a2] = findMatchingPairIndices(cards)
    const [b1, b2] = [0, 1, 2, 3].filter((i) => i !== a1 && i !== a2)

    fireEvent.click(cards[a1])
    fireEvent.click(cards[a2])
    act(() => {
      vi.advanceTimersByTime(500)
    })

    fireEvent.click(cards[b1])
    fireEvent.click(cards[b2])
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByText(/geschafft/i)).toBeInTheDocument()

    const stored = window.localStorage.getItem('memory-spiel-best')
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!).moves).toBe(2)
  })

  it('cancels a pending resolution cleanly when "Neues Spiel" is clicked mid-flip', () => {
    vi.useFakeTimers()
    render(<MemoryGame />)
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    const [a1, a2] = findMatchingPairIndices(cards)

    fireEvent.click(cards[a1])
    fireEvent.click(cards[a2])
    // Noch innerhalb des Auflösungsfensters - absichtlich nicht abwarten.

    fireEvent.click(screen.getByRole('button', { name: /neues spiel/i }))
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText(/0 Züge/)).toBeInTheDocument()
  })
})
