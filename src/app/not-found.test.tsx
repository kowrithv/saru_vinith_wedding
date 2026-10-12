import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotFound from './not-found'

const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

describe('NotFound', () => {
  beforeEach(() => {
    replaceMock.mockClear()
  })

  it('sends the visitor to the home page right away with a history replace', () => {
    render(<NotFound />)
    expect(replaceMock).toHaveBeenCalledWith('/')
  })

  it('falls back to a meta refresh to the home page for visitors without JavaScript', () => {
    render(<NotFound />)
    const refresh = document.querySelector('meta[http-equiv="refresh"]')
    expect(refresh).not.toBeNull()
    expect(refresh).toHaveAttribute('content', '0;url=/')
  })

  it('offers a visible link to the home page in case both redirects are blocked', () => {
    render(<NotFound />)
    expect(screen.getByRole('link', { name: /zur startseite/i })).toHaveAttribute('href', '/')
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<NotFound />)
    expect(container.firstElementChild).toHaveClass('pt-24')
  })
})
