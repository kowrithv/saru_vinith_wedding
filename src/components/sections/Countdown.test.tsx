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

  it('names date and start time without a note about the time zone', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<Countdown />)

    expect(screen.getByText('17. Oktober 2026 um 16:30 Uhr')).toBeInTheDocument()
    expect(screen.queryByText(/deutscher zeit/i)).not.toBeInTheDocument()
  })

  it('fits a 320 px phone: the small digits wrap instead of overflowing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<Countdown />)

    const hours = screen.getByText('06')
    const row = hours.closest('[data-testid="countdown-small"]')
    expect(row).toHaveClass('flex', 'flex-wrap')
  })

  it('says "Tag" for exactly one day left', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))
    render(<Countdown />)

    expect(screen.getByText('Tag')).toBeInTheDocument()
    expect(screen.queryByText('Tage')).not.toBeInTheDocument()
  })

  it('makes the days the main number and the rest companions', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<Countdown />)

    expect(screen.getByText('02')).toHaveClass('text-7xl')
    // Gerade Ziffern: in Cormorants Mediäval-Ziffern wird "01" zu "OI".
    expect(screen.getByText('02')).toHaveClass('lining-nums')
    expect(screen.getByText('06')).toHaveClass('lining-nums')
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

  // Die Zustände vom 17.10. und danach lassen sich vorab ansehen (?zeit=…).
  describe('preview of the day states', () => {
    afterEach(() => {
      window.history.replaceState({}, '', '/')
      window.sessionStorage.clear()
    })

    function atBeforeTheWedding(search: string) {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
      window.history.replaceState({}, '', `/${search}`)
    }

    it('shows the day itself with ?zeit=heute, although the real day is still ahead', () => {
      atBeforeTheWedding('?zeit=heute')
      render(<Countdown />)
      expect(screen.getByRole('heading', { name: /heute ist es so weit/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /fotos hochladen/i })).toHaveAttribute('href', '/gallery')
    })

    it('shows the running party with ?zeit=feier', () => {
      atBeforeTheWedding('?zeit=feier')
      render(<Countdown />)
      expect(screen.getByText(/wir sind verheiratet/i)).toBeInTheDocument()
      expect(screen.getByText(/danke, dass ihr mit uns feiert/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /fotos hochladen/i })).toBeInTheDocument()
    })

    it('shows the thank-you state with ?zeit=danach', () => {
      atBeforeTheWedding('?zeit=danach')
      render(<Countdown />)
      expect(screen.getByText(/wir sind verheiratet/i)).toBeInTheDocument()
      expect(screen.getByText(/danke, dass ihr mit uns gefeiert habt/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /erinnerung teilen/i })).toHaveAttribute('href', '/memories')
    })

    it('shows the normal countdown for an unknown value', () => {
      atBeforeTheWedding('?zeit=gestern')
      render(<Countdown />)
      expect(screen.getByText(/bis zu unserem empfang/i)).toBeInTheDocument()
    })
  })
})
