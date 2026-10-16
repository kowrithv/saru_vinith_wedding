import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ScoreBoard from './ScoreBoard'
import { SCORE_COLORS } from '@/lib/score-colors'

describe('ScoreBoard', () => {
  it('shows the couple, the occasion, the date and both teams', () => {
    render(<ScoreBoard score={{ bride: 7, groom: 4, rev: 11 }} status="live" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Saruga & Vinith' })).toBeInTheDocument()
    expect(screen.getByText('Standesamtliche Hochzeit')).toBeInTheDocument()
    expect(screen.getByText('17.10.2026')).toBeInTheDocument()
    expect(screen.getByText('Bride')).toBeInTheDocument()
    expect(screen.getByText('Groom')).toBeInTheDocument()
  })

  it('shows the points of each team', () => {
    render(<ScoreBoard score={{ bride: 7, groom: 12, rev: 1 }} status="live" />)
    expect(screen.getByLabelText('Punkte Team Bride: 7')).toHaveTextContent('7')
    expect(screen.getByLabelText('Punkte Team Groom: 12')).toHaveTextContent('12')
  })

  it('shows a dash instead of a wrong 0 until the first score has arrived', () => {
    render(<ScoreBoard score={null} status="connecting" />)
    expect(screen.getByLabelText('Punkte Team Bride: noch unbekannt')).toHaveTextContent('–')
    expect(screen.getByLabelText('Punkte Team Groom: noch unbekannt')).toHaveTextContent('–')
  })

  it('floats a "+1" over the team that just scored, but not for the first score', () => {
    const { rerender } = render(<ScoreBoard score={{ bride: 3, groom: 5, rev: 8 }} status="live" />)
    expect(screen.queryByText('+1')).not.toBeInTheDocument()

    rerender(<ScoreBoard score={{ bride: 4, groom: 5, rev: 9 }} status="live" />)
    expect(within(screen.getByRole('region', { name: 'Team Bride' })).getByText('+1')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Team Groom' })).queryByText('+1')).not.toBeInTheDocument()
  })

  it('floats nothing when a score goes down', () => {
    const { rerender } = render(<ScoreBoard score={{ bride: 3, groom: 5, rev: 8 }} status="live" />)
    rerender(<ScoreBoard score={{ bride: 3, groom: 4, rev: 9 }} status="live" />)
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument()
  })

  it('keeps the floating "+1" out of the screen reader text (the point is announced by the score itself)', () => {
    const { rerender } = render(<ScoreBoard score={{ bride: 3, groom: 5, rev: 8 }} status="live" />)
    rerender(<ScoreBoard score={{ bride: 3, groom: 6, rev: 9 }} status="live" />)
    expect(screen.getByText('+1')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByLabelText('Punkte Team Groom: 6')).toBeInTheDocument()
  })

  it('is the main content of its own page, since nothing of the site stands around it', () => {
    render(<ScoreBoard score={{ bride: 1, groom: 2, rev: 3 }} status="live" />)
    expect(screen.getByRole('main')).toHaveTextContent('Saruga & Vinith')
  })

  it('takes the team colours and the backdrop from the shared score colours', () => {
    const { container } = render(<ScoreBoard score={{ bride: 1, groom: 2, rev: 3 }} status="live" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--bride')).toBe(SCORE_COLORS.bride)
    expect(root.style.getPropertyValue('--bride-tape')).toBe(SCORE_COLORS.brideTape)
    expect(root.style.getPropertyValue('--groom')).toBe(SCORE_COLORS.groom)
    expect(root.style.getPropertyValue('--groom-tape')).toBe(SCORE_COLORS.groomTape)
    expect(root.style.getPropertyValue('--backdrop-center')).toBe(SCORE_COLORS.backdropCenter)
    expect(root.style.getPropertyValue('--backdrop-edge')).toBe(SCORE_COLORS.backdropEdge)
  })

  it.each([
    ['live', 'Live verbunden'],
    ['polling', 'Verbindung wird neu aufgebaut'],
    ['connecting', 'Verbindung wird aufgebaut'],
  ] as const)('tells the connection state quietly (%s)', (status, label) => {
    render(<ScoreBoard score={{ bride: 0, groom: 0, rev: 0 }} status={status} />)
    expect(screen.getByRole('status', { name: label })).toBeInTheDocument()
  })
})
