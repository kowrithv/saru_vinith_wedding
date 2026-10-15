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

  // Titel zuerst, die Uhrzeit darunter als schlichter Text: so liest sich der
  // Ablauf wie eine Karte, nicht wie eine Tabelle mit Etiketten.
  it('puts the time below the title as plain text, not as a chip', () => {
    render(<ProgramTimeline schedule={schedule} />)
    const title = screen.getByText('Einlass & Empfang der Gäste')
    const time = screen.getByText('16:30 Uhr')

    expect(title.parentElement).toBe(time.parentElement)
    expect(title.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(time).not.toHaveClass('rounded-full')
    expect(time).not.toHaveClass('bg-champagne')
  })

  it('puts "Uhrzeit folgt" below the title as well', () => {
    render(<ProgramTimeline schedule={schedule} />)
    const title = screen.getByText('Sektempfang & Gratulationen')
    const items = screen.getAllByText('Uhrzeit folgt')
    expect(items[0].parentElement).toBe(title.parentElement)
    expect(title.compareDocumentPosition(items[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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

  it('shows approximate times and ranges as written', () => {
    render(
      <ProgramTimeline
        schedule={[
          { time: 'ca. 18:30 Uhr', event: 'Traditioneller Einzug' },
          { time: 'ca. 20:00 – 21:00 Uhr', event: 'Gemeinsames Abendessen' },
        ]}
      />
    )
    expect(screen.getByText('ca. 18:30 Uhr')).toHaveClass('text-gold-text')
    expect(screen.getByText('ca. 20:00 – 21:00 Uhr')).toBeInTheDocument()
    expect(screen.queryByText('Uhrzeit folgt')).not.toBeInTheDocument()
  })

  it('marks an item with an approximate time as next on the wedding day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T15:45:00+02:00'))
    render(
      <ProgramTimeline
        schedule={[
          { time: '16:30 Uhr', event: 'Einlass' },
          { time: 'ca. 18:30 Uhr', event: 'Traditioneller Einzug' },
        ]}
      />
    )
    const next = screen.getByText(/als nächstes/i).closest('li')
    expect(next).toHaveTextContent('Einlass')
  })
})
