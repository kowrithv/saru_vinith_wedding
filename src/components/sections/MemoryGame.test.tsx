import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemoryGame from './MemoryGame'
import { MEMORY_PAIRS_COUNT, memoryImages } from '@/lib/memory-content'
import { preloadImages } from '@/lib/preload-images'

// Zwei Paare (vier Karten) statt der echten acht reichen, um
// Auflösung/Gewinnlogik zu testen, ohne ein komplettes Spiel
// durchklicken zu müssen - die Tests selbst lesen MEMORY_PAIRS_COUNT
// weiterhin aus dem (gemockten) Modul, bleiben also unabhängig vom Wert.
vi.mock('@/lib/memory-content', () => ({
  memoryImages: ['/test/a.jpg', '/test/b.jpg'],
  MEMORY_PAIRS_COUNT: 2,
}))

vi.mock('@/lib/preload-images', () => ({ preloadImages: vi.fn() }))

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

// Spielt ein komplettes Zwei-Paare-Spiel mit zwei Zügen (die bestmögliche Wertung).
function playPerfectGame() {
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
}

describe('MemoryGame', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let serverRecord: { moves: number; seconds: number } | null

  beforeEach(() => {
    serverRecord = null
    fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const result = JSON.parse(init.body as string) as { moves: number; seconds: number }
        const isNew =
          !serverRecord ||
          result.moves < serverRecord.moves ||
          (result.moves === serverRecord.moves && result.seconds < serverRecord.seconds)
        if (isNew) serverRecord = result
        return { ok: true, json: async () => ({ record: serverRecord, isNewRecord: isNew }) }
      }
      return { ok: true, json: async () => ({ record: serverRecord }) }
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
    vi.unstubAllGlobals()
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

  it('shows the record of all guests next to the personal best', async () => {
    serverRecord = { moves: 11, seconds: 42 }
    render(<MemoryGame />)

    expect(await screen.findByTestId('memory-record-banner')).toHaveTextContent(/rekord aller gäste: 11 züge · 00:42/i)
  })

  it('shows no record line while no guest has finished a game', async () => {
    render(<MemoryGame />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/memory-record'))

    expect(screen.queryByText(/rekord aller gäste/i)).not.toBeInTheDocument()
  })

  describe('timer', () => {
    it('does not run before the first card is turned', () => {
      vi.useFakeTimers()
      render(<MemoryGame />)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(screen.getByText('00:00')).toBeInTheDocument()
    })

    it('starts with the first card and counts from there', () => {
      vi.useFakeTimers()
      render(<MemoryGame />)
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      fireEvent.click(screen.getAllByRole('button', { name: 'Karte umdrehen' })[0])
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(screen.getByText('00:03')).toBeInTheDocument()
    })

    it('reports the seconds counted from the first card, not from the page load', async () => {
      vi.useFakeTimers()
      render(<MemoryGame />)
      await act(async () => {})
      act(() => {
        vi.advanceTimersByTime(30_000)
      })

      playPerfectGame()
      await act(async () => {})

      const posts = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
      expect(JSON.parse((posts[0][1] as RequestInit).body as string)).toEqual({ moves: 2, seconds: 1 })
    })

    it('waits for the first card again after "Neues Spiel"', () => {
      vi.useFakeTimers()
      render(<MemoryGame />)
      fireEvent.click(screen.getAllByRole('button', { name: 'Karte umdrehen' })[0])
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(screen.getByText('00:03')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Neues Spiel' }))
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(screen.getByText('00:00')).toBeInTheDocument()
    })
  })

  it('reports a finished game to the server exactly once, with moves and seconds', async () => {
    vi.useFakeTimers()
    render(<MemoryGame />)
    await act(async () => {})

    playPerfectGame()
    await act(async () => {})

    const posts = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0][0]).toBe('/api/memory-record')
    expect(JSON.parse((posts[0][1] as RequestInit).body as string)).toEqual({ moves: 2, seconds: 1 })
  })

  it('announces a new record of all guests and shows the new value', async () => {
    vi.useFakeTimers()
    render(<MemoryGame />)
    await act(async () => {})

    playPerfectGame()
    await act(async () => {})

    expect(screen.getByText(/neuer rekord/i)).toBeInTheDocument()
    expect(screen.getByTestId('memory-record-banner')).toHaveTextContent(/rekord aller gäste: 2 züge/i)
  })

  it('does not announce a record when the server already has a better one', async () => {
    vi.useFakeTimers()
    serverRecord = { moves: 1, seconds: 1 }
    render(<MemoryGame />)
    await act(async () => {})

    playPerfectGame()
    await act(async () => {})

    expect(screen.queryByText(/neuer rekord/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('memory-record-banner')).toHaveTextContent(/rekord aller gäste: 1 züge/i)
  })

  it('keeps the game working when the record cannot be loaded or reported', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<MemoryGame />)
    await act(async () => {})

    playPerfectGame()
    await act(async () => {})

    expect(screen.getByText(/geschafft/i)).toBeInTheDocument()
    expect(screen.queryByText(/rekord aller gäste/i)).not.toBeInTheDocument()
  })

  it('labels the personal best as the visitor\'s own', () => {
    window.localStorage.setItem('memory-spiel-best', JSON.stringify({ moves: 9, seconds: 70 }))
    render(<MemoryGame />)

    expect(screen.getByText(/dein bestes ergebnis: 9 züge · 01:10/i)).toBeInTheDocument()
    expect(screen.queryByText(/bestzeit/i)).not.toBeInTheDocument()
  })

  it('does not carry the record message over into the next game', async () => {
    vi.useFakeTimers()
    render(<MemoryGame />)
    await act(async () => {})
    playPerfectGame()
    await act(async () => {})
    expect(screen.getByText(/neuer rekord/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /neues spiel/i }))
    playPerfectGame()

    // Die Antwort des Servers für das zweite Spiel ist noch nicht da.
    expect(screen.queryByText(/neuer rekord/i)).not.toBeInTheDocument()
  })

  it('keeps room for the record lines from the first render so the board does not jump when they load', () => {
    render(<MemoryGame />)
    expect(screen.getByTestId('memory-record-row')).toHaveClass('min-h-11')
  })

  it('announces the finish message to assistive technology', async () => {
    vi.useFakeTimers()
    render(<MemoryGame />)
    await act(async () => {})

    playPerfectGame()
    await act(async () => {})

    expect(screen.getByRole('status')).toHaveTextContent(/geschafft/i)
  })

  it('does not let the late answer of the previous game announce a record in the next game', async () => {
    vi.useFakeTimers()
    const pendingPosts: ((value: unknown) => void)[] = []
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return new Promise((resolve) => pendingPosts.push(resolve))
      return { ok: true, json: async () => ({ record: null }) }
    })
    render(<MemoryGame />)
    await act(async () => {})

    playPerfectGame()
    fireEvent.click(screen.getByRole('button', { name: /neues spiel/i }))
    // Die Antwort des ersten Spiels kommt erst, nachdem das zweite begonnen hat.
    await act(async () => {
      pendingPosts[0]({ ok: true, json: async () => ({ record: { moves: 2, seconds: 1 }, isNewRecord: true }) })
    })
    playPerfectGame()

    expect(screen.queryByText(/neuer rekord/i)).not.toBeInTheDocument()
    // Der gebrochene Rekord selbst wird trotzdem angezeigt.
    expect(screen.getByTestId('memory-record-banner')).toHaveTextContent(/rekord aller gäste: 2 züge/i)
  })

  it('ignores a slow initial record answer that arrives after a newer answer', async () => {
    vi.useFakeTimers()
    let resolveInitialGet!: (value: unknown) => void
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ record: { moves: 2, seconds: 1 }, isNewRecord: true }) }
      }
      return new Promise((resolve) => {
        resolveInitialGet = resolve
      })
    })
    render(<MemoryGame />)
    await act(async () => {})

    playPerfectGame()
    await act(async () => {})
    expect(screen.getByTestId('memory-record-banner')).toHaveTextContent(/rekord aller gäste: 2 züge/i)

    await act(async () => {
      resolveInitialGet({ ok: true, json: async () => ({ record: null }) })
    })

    expect(screen.getByTestId('memory-record-banner')).toHaveTextContent(/rekord aller gäste: 2 züge/i)
  })

  it('keeps the shown record when the server answers a report with an error status', async () => {
    vi.useFakeTimers()
    serverRecord = { moves: 5, seconds: 50 }
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: false, status: 429, json: async () => ({ error: 'Zu viele Anfragen.' }) }
      return { ok: true, json: async () => ({ record: serverRecord }) }
    })
    render(<MemoryGame />)
    await act(async () => {})

    playPerfectGame()
    await act(async () => {})

    expect(screen.getByTestId('memory-record-banner')).toHaveTextContent(/rekord aller gäste: 5 züge/i)
    expect(screen.queryByText(/neuer rekord/i)).not.toBeInTheDocument()
  })

  it('shows the lotus on the back of every card instead of a plain heart', () => {
    render(<MemoryGame />)
    const backs = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    backs.forEach((card) => expect(card.querySelector('svg.text-gold')).toBeInTheDocument())
  })

  // Rekord als dunkles Band oben, Zahlen in Gold (Vorschlag C15).
  describe('record banner', () => {
    it('shows the record of all guests as a navy band with gold figures above the counters', async () => {
      serverRecord = { moves: 14, seconds: 58 }
      render(<MemoryGame />)

      const banner = await screen.findByTestId('memory-record-banner')
      expect(banner).toHaveClass('bg-dark-blue', 'text-white')
      expect(banner.querySelector('b')).toHaveClass('text-gold')
      expect(banner.querySelector('b')).toHaveTextContent('14 Züge · 00:58')
      expect(banner.querySelector('svg.text-gold')).not.toBeNull()

      const counters = screen.getByText(/0 Züge/)
      expect(banner.compareDocumentPosition(counters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('shows no band while there is no record yet', async () => {
      render(<MemoryGame />)
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/memory-record'))
      expect(screen.queryByTestId('memory-record-banner')).not.toBeInTheDocument()
    })
  })

  // Zwei Schatten-Klassen setzen dieselbe Variable: im Stylesheet gewinnt die
  // später definierte, und der innere Doppelrand der Kartenrücken fehlte.
  it('draws the double border on the card backs with exactly one shadow utility', () => {
    render(<MemoryGame />)
    const card = screen.getAllByRole('button', { name: 'Karte umdrehen' })[0]
    const back = card.querySelector('svg.text-gold')?.parentElement as HTMLElement
    expect(back.className).toContain('inset_0_0_0_4px')
    expect(back.className).not.toMatch(/\bshadow-(sm|md|lg|xl)\b/)
  })

  it('crowns a finished game with the lotus instead of an emoji', async () => {
    vi.useFakeTimers()
    render(<MemoryGame />)
    await act(async () => {})
    playPerfectGame()
    await act(async () => {})

    const finish = screen.getByRole('status')
    expect(finish).toHaveTextContent('Geschafft!')
    expect(finish.querySelector('svg.text-gold')).not.toBeNull()
  })

  // Alle Bilder werden sofort geholt, nicht nur die der ersten Mischung: nach
  // "Neues Spiel" sind andere dabei, und eine leere Karte beim Umdrehen wäre
  // am Handy im Veranstaltungs-WLAN gut sichtbar.
  it('preloads all images of the game, including those not dealt yet', () => {
    render(<MemoryGame />)
    expect(preloadImages).toHaveBeenCalledWith(memoryImages)
  })
})
