import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import InfoPage from './page'
import { receptionEvent, receptionSchedule } from '@/lib/event-info'

vi.mock('@/components/sections/VenueMap', () => ({
  default: () => <div data-testid="venue-map-stub" />,
}))

describe('InfoPage', () => {
  it('renders date, time, venue and address', () => {
    render(<InfoPage />)
    expect(screen.getAllByText(receptionEvent.displayDate).length).toBeGreaterThan(0)
    expect(screen.getAllByText(receptionEvent.time).length).toBeGreaterThan(0)
    expect(screen.getByText(receptionEvent.venue)).toBeInTheDocument()
    expect(screen.getByText(receptionEvent.address)).toBeInTheDocument()
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
})
