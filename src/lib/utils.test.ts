import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins multiple class strings', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('resolves conflicting Tailwind utilities, keeping the last one', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
  })

  it('applies conditional classes based on a boolean', () => {
    const isActive = true
    expect(cn('base', isActive && 'active')).toBe('base active')
  })
})
