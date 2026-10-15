import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorPage from './error'

describe('error page', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('says in German that something went wrong and offers another try', async () => {
    const reset = vi.fn()
    render(<ErrorPage error={new Error('boom')} reset={reset} />)

    expect(screen.getByRole('heading', { name: /das hat leider nicht geklappt/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /erneut versuchen/i }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('leads back to the start page', () => {
    render(<ErrorPage error={new Error('boom')} reset={() => {}} />)
    expect(screen.getByRole('link', { name: /zur startseite/i })).toHaveAttribute('href', '/')
  })

  it('does not show technical details to guests, but writes them to the log', () => {
    render(<ErrorPage error={new Error('SQLITE_BUSY geheim')} reset={() => {}} />)
    expect(screen.queryByText(/sqlite_busy/i)).not.toBeInTheDocument()
    expect(console.error).toHaveBeenCalled()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<ErrorPage error={new Error('x')} reset={() => {}} />)
    expect(container.firstChild).toHaveClass('pt-24')
  })
})
