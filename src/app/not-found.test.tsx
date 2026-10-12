import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotFound from './not-found'

const redirectMock = vi.fn((path: string): never => {
  // Das echte redirect() wirft einen Fehler, der das Rendern abbricht.
  throw new Error(`NEXT_REDIRECT:${path}`)
})

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

describe('NotFound', () => {
  beforeEach(() => {
    redirectMock.mockClear()
  })

  it('redirects every unmatched URL to the home page', () => {
    expect(() => NotFound()).toThrow('NEXT_REDIRECT:/')
    expect(redirectMock).toHaveBeenCalledWith('/')
  })
})
