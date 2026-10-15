import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import VenueMap from './VenueMap'

vi.mock('@/lib/calendar', () => ({ downloadEventIcs: vi.fn() }))

const mergeOptions = vi.fn()
const openPopup = vi.fn()

vi.mock('leaflet', () => ({
  default: {
    Icon: { Default: { mergeOptions, prototype: {} } },
    map: vi.fn(() => ({ remove: vi.fn() })),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => ({
      addTo: vi.fn(() => ({ bindPopup: vi.fn(() => ({ openPopup })) })),
    })),
  },
}))

describe('VenueMap', () => {
  const props = {
    lat: 51.196771,
    lng: 6.213148,
    label: 'Begegnungsstätte Niederkrüchten',
    address: 'Oberkrüchtener Weg 42, 41372 Niederkrüchten',
  }

  it('links to Google Maps directions with the correct coordinates', () => {
    render(<VenueMap {...props} />)
    const link = screen.getByRole('link', { name: /Route planen/i })
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=51.196771,6.213148'
    )
  })

  it('links to OpenStreetMap with the correct coordinates', () => {
    render(<VenueMap {...props} />)
    const link = screen.getByRole('link', { name: /OpenStreetMap/i })
    expect(link).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/?mlat=51.196771&mlon=6.213148#map=17/51.196771/6.213148'
    )
  })

  it('configures Leaflet marker icons from the app origin, never an external CDN', async () => {
    render(<VenueMap {...props} />)
    await waitFor(() => expect(mergeOptions).toHaveBeenCalled())
    const options = mergeOptions.mock.calls[0][0]
    expect(options.iconUrl).toBe('/leaflet/marker-icon.png')
    expect(options.iconRetinaUrl).toBe('/leaflet/marker-icon-2x.png')
    expect(options.shadowUrl).toBe('/leaflet/marker-shadow.png')
    ;[options.iconUrl, options.iconRetinaUrl, options.shadowUrl].forEach((url) => {
      expect(url.startsWith('http')).toBe(false)
    })
  })

  // Werden die Kacheln von OpenStreetMap blockiert (Veranstaltungs-WLAN), bleibt
  // die Fläche nicht grau: dahinter liegt eine feste Karte der Umgebung.
  it('has a static picture of the area behind the live map', () => {
    const { container } = render(<VenueMap {...props} />)
    const mapArea = container.querySelector('.h-64') as HTMLElement
    expect(mapArea.style.backgroundImage).toContain('/info/karte.jpg')
  })

  // Das geöffnete Infofenster verdeckte Kartenausschnitt und Zoom-Knöpfe, und
  // der Name steht ohnehin direkt unter der Karte.
  it('does not open the marker popup by itself', async () => {
    openPopup.mockClear()
    render(<VenueMap {...props} />)
    await waitFor(() => expect(mergeOptions).toHaveBeenCalled())
    expect(openPopup).not.toHaveBeenCalled()
  })

  // Leaflet vergibt intern z-index bis 1000: ohne eigenen Stapelkontext liegt
  // die Karte beim Scrollen über der fixen Navigation (z-50).
  it('keeps the map in its own stacking context so it never covers the fixed navigation', () => {
    const { container } = render(<VenueMap {...props} />)
    expect(container.firstElementChild).toHaveClass('isolate')
  })

  // Eine Karte mit den zwei Handlungen, die Gäste brauchen: Route und Kalender
  // (Vorschlag C7).
  describe('venue card', () => {
    const withParking = { ...props, parking: 'Parkplätze direkt an der Begegnungsstätte' }

    it('names the venue and shows its address under the map', () => {
      render(<VenueMap {...withParking} />)
      expect(screen.getByRole('heading', { name: props.label })).toBeInTheDocument()
      expect(screen.getByText(props.address)).toBeInTheDocument()
    })

    it('shows the route button in bordeaux', () => {
      render(<VenueMap {...withParking} />)
      expect(screen.getByRole('link', { name: /Route planen/i })).toHaveClass('bg-bordeaux')
    })

    it('offers to save the date in the calendar right there', () => {
      render(<VenueMap {...withParking} />)
      expect(screen.getByRole('button', { name: /in kalender speichern/i })).toBeInTheDocument()
    })

    it('shows the parking note with a P badge that assistive technology skips', () => {
      render(<VenueMap {...withParking} />)
      const note = screen.getByText(withParking.parking)
      const badge = note.querySelector('[aria-hidden="true"]')
      expect(badge).toHaveTextContent('P')
    })

    it('shows no parking line when there is no note', () => {
      render(<VenueMap {...props} />)
      expect(screen.queryByText(/parkplätze/i)).not.toBeInTheDocument()
    })
  })
})
