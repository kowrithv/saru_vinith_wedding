import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import Countdown from './Countdown'

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

    expect(screen.getByText('Tage')).toBeInTheDocument()
    expect(screen.queryByText(/verheiratet/i)).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(1000)

    expect(screen.getByText(/verheiratet/i)).toBeInTheDocument()
    expect(screen.queryByText('Tage')).not.toBeInTheDocument()
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

  it('fits a 320 px phone: small boxes and no separator dots below the sm breakpoint', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<Countdown />)

    // 4 x w-16 (64 px) + 3 x gap-2 (8 px) = 280 px.
    const box = screen.getByText('02').parentElement
    expect(box).toHaveClass('w-16', 'h-16')
    const separators = screen.getAllByTestId('countdown-separator')
    expect(separators).toHaveLength(3)
    separators.forEach((separator) => expect(separator).toHaveClass('hidden', 'sm:flex'))
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
})
