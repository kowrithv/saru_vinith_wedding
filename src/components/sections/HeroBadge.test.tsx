import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import HeroBadge from './HeroBadge'

describe('HeroBadge', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('says "Wir heiraten!" in the server HTML, whatever time it is', () => {
    expect(renderToString(<HeroBadge />)).toContain('Wir heiraten!')
  })

  it('says "Wir heiraten!" before the reception', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
    render(<HeroBadge />)
    expect(screen.getByText('Wir heiraten!')).toBeInTheDocument()
  })

  it('switches to "Wir sind verheiratet!" once the reception has started', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T15:00:00Z'))
    render(<HeroBadge />)
    expect(screen.getByText('Wir sind verheiratet!')).toBeInTheDocument()
    expect(screen.queryByText('Wir heiraten!')).not.toBeInTheDocument()
  })
})
