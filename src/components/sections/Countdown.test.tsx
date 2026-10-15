import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import Countdown from './Countdown'
import { downloadEventIcs } from '@/lib/calendar'

vi.mock('@/lib/calendar', () => ({ downloadEventIcs: vi.fn() }))

// Alle Zeitpunkte absolut (Z): 16:30 Uhr deutscher Zeit am 17.10. = 14:30 UTC.
describe('Countdown', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows live countdown digits', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<Countdown />)

    expect(screen.getByText('Tage')).toBeInTheDocument()
    expect(screen.getByText('02')).toBeInTheDocument()
    expect(screen.getByText('06')).toBeInTheDocument()
  })

  it('counts down to 16:30 German time, not to 16:30 on the visitor device', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T14:29:59Z'))
    render(<Countdown />)

    expect(screen.getByText('Sekunden')).toBeInTheDocument()
    expect(screen.queryByText(/verheiratet/i)).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(1000)

    expect(screen.getByText(/verheiratet/i)).toBeInTheDocument()
    expect(screen.queryByText('Sekunden')).not.toBeInTheDocument()
  })

  it('ticks every second', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T14:29:00Z'))
    render(<Countdown />)
    expect(screen.getByText('01')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(1000)

    expect(screen.getByText('59')).toBeInTheDocument()
  })

  it('stops its timer when it unmounts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    const { unmount } = render(<Countdown />)
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops ticking by itself once the reception has started', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T14:29:59Z'))
    render(<Countdown />)

    await vi.advanceTimersByTimeAsync(1500)

    expect(screen.getByText(/verheiratet/i)).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('labels the start time as German time for guests abroad', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<Countdown />)

    expect(screen.getByText(/16:30 Uhr \(deutscher Zeit\)/)).toBeInTheDocument()
  })

  it('fits a 320 px phone: the small digits wrap instead of overflowing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<Countdown />)

    const hours = screen.getByText('06')
    const row = hours.closest('[data-testid="countdown-small"]')
    expect(row).toHaveClass('flex', 'flex-wrap')
  })

  it('makes the days the main number and the rest companions', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<Countdown />)

    expect(screen.getByText('02')).toHaveClass('text-7xl')
    expect(screen.getByText(/bis zu unserem empfang/i)).toBeInTheDocument()
    expect(screen.getByText('Stunden')).toBeInTheDocument()
    expect(screen.getByText('Minuten')).toBeInTheDocument()
    expect(screen.getByText('Sekunden')).toBeInTheDocument()
  })

  it('offers to save the date in the calendar before the wedding', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<Countdown />)

    const button = screen.getByRole('button', { name: /in meinen kalender/i })
    button.click()

    expect(downloadEventIcs).toHaveBeenCalledTimes(1)
  })

  it('on the wedding day, before the start, says so and puts the three useful links first', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T09:00:00Z'))
    render(<Countdown />)

    expect(screen.getByRole('heading', { name: /heute ist es so weit/i })).toBeInTheDocument()
    expect(screen.queryByText('Tage')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /fotos hochladen/i })).toHaveAttribute('href', '/gallery')
    expect(screen.getByRole('link', { name: /ablauf des tages/i })).toHaveAttribute('href', '/info')
    expect(screen.getByRole('link', { name: /ins gästebuch schreiben/i })).toHaveAttribute('href', '/guestbook')
  })

  it('the day after the wedding says thank you and points to photos, memories and the guestbook', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T10:00:00Z'))
    render(<Countdown />)

    expect(screen.getByText(/verheiratet/i)).toBeInTheDocument()
    expect(screen.getByText(/danke/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /fotos ansehen/i })).toHaveAttribute('href', '/gallery')
    expect(screen.getByRole('link', { name: /erinnerung teilen/i })).toHaveAttribute('href', '/memories')
    expect(screen.getByRole('link', { name: /gästebuch/i })).toHaveAttribute('href', '/guestbook')
  })

  it('has no emoji', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T15:00:00Z'))
    const { container } = render(<Countdown />)
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
  })

  it('switches to the celebration state with links to the photo gallery and the guestbook', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T15:00:00Z'))
    render(<Countdown />)

    expect(screen.getByText(/verheiratet/i)).toBeInTheDocument()
    expect(screen.queryByText(/countdown zum empfang/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /fotos hochladen/i })).toHaveAttribute('href', '/gallery')
    expect(screen.getByRole('link', { name: /gästebuch/i })).toHaveAttribute('href', '/guestbook')
  })

  it('does not show the celebration links before the reception', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<Countdown />)

    expect(screen.queryByRole('link', { name: /fotos hochladen/i })).not.toBeInTheDocument()
  })

  it('hydrates the server-rendered skeleton without a mismatch and then shows the digits', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    const html = renderToString(<Countdown />)
    expect(html).not.toContain('Tage')

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const errors: unknown[] = []
    let root!: ReturnType<typeof hydrateRoot>

    await act(async () => {
      root = hydrateRoot(container, <Countdown />, { onRecoverableError: (error) => errors.push(error) })
    })

    expect(errors).toEqual([])
    expect(container.textContent).toContain('Tage')

    await act(async () => root.unmount())
    container.remove()
  })

  it('is the target of the hero anchor', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    const { container } = render(<Countdown />)
    expect(container.querySelector('section#countdown')).not.toBeNull()
  })

  // Zum Vergleichen: ?countdown=kacheln zeigt die frühere Version (vier gleich
  // große weiße Kacheln), ?countdown=gross die jetzige. Ohne Angabe sieht
  // niemand einen Umschalter.
  describe('versions', () => {
    afterEach(() => {
      window.history.replaceState({}, '', '/')
    })

    function atBeforeTheWedding(search: string) {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
      window.history.replaceState({}, '', `/${search}`)
    }

    it('shows the big days and no switcher by default', () => {
      atBeforeTheWedding('')
      render(<Countdown />)
      expect(screen.getByText(/bis zu unserem empfang/i)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /kacheln/i })).not.toBeInTheDocument()
    })

    it('shows four equal white tiles with ?countdown=kacheln', () => {
      atBeforeTheWedding('?countdown=kacheln')
      render(<Countdown />)

      const tiles = screen.getAllByTestId('countdown-tile')
      expect(tiles).toHaveLength(4)
      expect(tiles[0]).toHaveTextContent('02')
      expect(tiles[0]).toHaveTextContent('Tage')
      expect(tiles[3]).toHaveTextContent('Sekunden')
      expect(tiles[0]).toHaveClass('bg-white')
      expect(screen.queryByText(/bis zu unserem empfang/i)).not.toBeInTheDocument()
    })

    it('keeps the calendar button and the German time note in the tile version', () => {
      atBeforeTheWedding('?countdown=kacheln')
      render(<Countdown />)
      expect(screen.getByRole('button', { name: /kalender/i })).toBeInTheDocument()
      expect(screen.getByText(/deutscher zeit/i)).toBeInTheDocument()
    })

    it('offers links to switch between the versions while one is requested', () => {
      atBeforeTheWedding('?countdown=gross')
      render(<Countdown />)
      expect(screen.getByRole('link', { name: /kacheln/i })).toHaveAttribute('href', '/?countdown=kacheln#countdown')
      expect(screen.getByRole('link', { name: /große tage/i })).toHaveAttribute('href', '/?countdown=gross#countdown')
    })

    it('falls back to the big days for an unknown value', () => {
      atBeforeTheWedding('?countdown=quatsch')
      render(<Countdown />)
      expect(screen.getByText(/bis zu unserem empfang/i)).toBeInTheDocument()
    })

    it('does not change the wedding day or the thank-you state', () => {
      atBeforeTheWedding('?countdown=kacheln')
      vi.setSystemTime(new Date('2026-10-17T09:00:00Z'))
      render(<Countdown />)
      expect(screen.getByRole('heading', { name: /heute ist es so weit/i })).toBeInTheDocument()
      expect(screen.queryByTestId('countdown-tile')).not.toBeInTheDocument()
    })
  })
})
