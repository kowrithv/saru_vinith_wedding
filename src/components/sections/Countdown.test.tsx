import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Countdown from './Countdown'

describe('Countdown', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows live countdown digits after mounting', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T10:00:00'))
    render(<Countdown />)

    await vi.advanceTimersByTimeAsync(0)

    expect(screen.getByText('Tage')).toBeInTheDocument()
    expect(screen.getByText('02')).toBeInTheDocument()
  })

  it('shows the married message once the reception date has passed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T10:00:00'))
    render(<Countdown />)

    await vi.advanceTimersByTimeAsync(0)

    expect(screen.getByText(/verheiratet/i)).toBeInTheDocument()
    expect(screen.queryByText('Tage')).not.toBeInTheDocument()
  })
})
