import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import InfoPage from './page'
import { receptionEvent, receptionSchedule } from '@/lib/event-info'

vi.mock('@/components/sections/VenueMap', () => ({
  default: ({ label, address, parking }: { label: string; address: string; parking?: string }) => (
    <div data-testid="venue-map-stub">
      <span>{label}</span>
      <span>{address}</span>
      <span>{parking}</span>
    </div>
  ),
}))

describe('InfoPage', () => {
  it('renders date, time, venue and address', () => {
    render(<InfoPage />)
    expect(screen.getAllByText(receptionEvent.displayDate).length).toBeGreaterThan(0)
    expect(screen.getAllByText(receptionEvent.time).length).toBeGreaterThan(0)
    // Der Ort steht in der Anfahrt-Karte (hier ersetzt) und auch in der Liste der Dienstleister.
    const venueCard = within(screen.getByTestId('venue-map-stub'))
    expect(venueCard.getByText(receptionEvent.venue)).toBeInTheDocument()
    expect(venueCard.getByText(receptionEvent.address)).toBeInTheDocument()
  })

  it('renders every schedule item', () => {
    render(<InfoPage />)
    receptionSchedule.forEach((item) => {
      expect(screen.getByText(item.event)).toBeInTheDocument()
    })
  })

  it('renders the venue map', () => {
    render(<InfoPage />)
    expect(screen.getByTestId('venue-map-stub')).toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<InfoPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })

  it('shows the schedule times in a gold that is readable on the card', () => {
    render(<InfoPage />)
    // Die Uhrzeit steht auch oben im Kopf der Seite: es geht um den Ablauf.
    const matches = screen.getAllByText(receptionSchedule[0].time)
    expect(matches.some((el) => el.classList.contains('text-gold-text'))).toBe(true)
  })

  // Datum, Uhrzeit, Ort und Parken sind in einer Anfahrt-Karte zusammengefasst
  // (Vorschlag C7), nicht mehr vier einzelne Info-Karten neben der Karte.
  it('has one venue card instead of four separate info cards', () => {
    render(<InfoPage />)
    expect(screen.queryByText(/^Datum$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Uhrzeit$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Parken$/)).not.toBeInTheDocument()
  })

  it('hands the parking note to the venue card', () => {
    render(<InfoPage />)
    expect(screen.getByTestId('venue-map-stub')).toHaveTextContent(/parkplätze direkt an der begegnungsstätte/i)
  })

  it('leaves the calendar button to the venue card instead of showing a second one', () => {
    render(<InfoPage />)
    expect(screen.queryByRole('button', { name: /kalender/i })).not.toBeInTheDocument()
  })

  // Aufbau: Kopf mit dem Datum groß, darunter Ablauf und Anfahrt nebeneinander
  // (auf dem Handy untereinander), die Dienstleister ruhig am Ende.
  it('shows the weekday and the date as the headline of the day', () => {
    render(<InfoPage />)
    expect(screen.getByText('Samstag')).toBeInTheDocument()
    expect(screen.getByText(receptionEvent.displayDate)).toHaveClass('font-display')
  })

  it('puts the programme first and the venue next to it', () => {
    render(<InfoPage />)
    const columns = screen.getByTestId('info-columns')
    expect(columns).toHaveClass('lg:grid-cols-2')
    const [programme, venue] = Array.from(columns.children)
    expect(programme).toHaveTextContent('Ablauf des Tages')
    expect(venue).toContainElement(screen.getByTestId('venue-map-stub'))
  })

  it('thanks the service providers at the end of the page', () => {
    render(<InfoPage />)
    expect(screen.getByRole('heading', { name: /unsere dienstleister/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /dj tastic/i })).toHaveAttribute('href', 'https://www.instagram.com/djtastic_de')
  })
})
