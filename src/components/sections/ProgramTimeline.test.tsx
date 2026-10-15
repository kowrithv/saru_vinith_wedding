import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import ProgramTimeline from './ProgramTimeline'

const schedule = [
  { time: '16:30 Uhr', event: 'Einlass & Empfang der Gäste' },
  { time: 'TBA', event: 'Sektempfang & Gratulationen' },
  { time: 'TBA', event: 'Party & Tanz' },
]

describe('ProgramTimeline', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists every programme item in order', () => {
    render(<ProgramTimeline schedule={schedule} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Einlass & Empfang der Gäste')
    expect(items[2]).toHaveTextContent('Party & Tanz')
  })

  it('shows "Uhrzeit folgt" for items without a time, never "TBA"', () => {
    render(<ProgramTimeline schedule={schedule} />)
    expect(screen.getAllByText('Uhrzeit folgt')).toHaveLength(2)
    expect(screen.queryByText('TBA')).not.toBeInTheDocument()
  })

  it('shows known times in the gold that is readable on champagne', () => {
    render(<ProgramTimeline schedule={schedule} />)
    expect(screen.getByText('16:30 Uhr')).toHaveClass('text-gold-text')
  })

  it('marks nothing as next before the wedding day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<ProgramTimeline schedule={schedule} />)
    expect(screen.queryByText(/als nächstes/i)).not.toBeInTheDocument()
  })

  it('marks the next item on the wedding day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T10:00:00Z'))
    render(<ProgramTimeline schedule={schedule} />)

    const next = screen.getByText(/als nächstes/i).closest('li')
    expect(next).toHaveTextContent('Einlass & Empfang der Gäste')
  })

  it('marks nothing once the timed items are over', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T20:00:00Z'))
    render(<ProgramTimeline schedule={schedule} />)
    expect(screen.queryByText(/als nächstes/i)).not.toBeInTheDocument()
  })

  it('renders the same on the server: no highlight in the HTML', () => {
    const html = renderToString(<ProgramTimeline schedule={schedule} />)
    expect(html).toContain('Einlass &amp; Empfang der Gäste')
    expect(html).not.toMatch(/als nächstes/i)
  })
})
