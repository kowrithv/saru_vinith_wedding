import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { syncRound, useWhoVotes } from './who-local-votes'

describe('syncRound', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('keeps the remembered answers while the round is the same', () => {
    window.localStorage.setItem('who-game-votes', JSON.stringify({ '1': 'Beide' }))

    syncRound('0')

    expect(JSON.parse(window.localStorage.getItem('who-game-votes') as string)).toEqual({ '1': 'Beide' })
  })

  it('treats a browser without a remembered round as part of the first round', () => {
    window.localStorage.setItem('who-game-votes', JSON.stringify({ '1': 'Beide' }))

    syncRound('0')

    expect(window.localStorage.getItem('who-game-round')).toBeNull()
    expect(window.localStorage.getItem('who-game-votes')).not.toBeNull()
  })

  it('forgets the answers when the voting was reset and remembers the new round', () => {
    window.localStorage.setItem('who-game-votes', JSON.stringify({ '1': 'Beide', '2': 'Vinith' }))

    syncRound('1')

    expect(window.localStorage.getItem('who-game-votes')).toBeNull()
    expect(window.localStorage.getItem('who-game-round')).toBe('1')
  })

  it('does it only once for a round', () => {
    syncRound('1')
    window.localStorage.setItem('who-game-votes', JSON.stringify({ '3': 'Saruga' }))

    syncRound('1')

    expect(JSON.parse(window.localStorage.getItem('who-game-votes') as string)).toEqual({ '3': 'Saruga' })
  })

  it('also resets after a second reset', () => {
    syncRound('1')
    window.localStorage.setItem('who-game-votes', JSON.stringify({ '3': 'Saruga' }))

    syncRound('2')

    expect(window.localStorage.getItem('who-game-votes')).toBeNull()
    expect(window.localStorage.getItem('who-game-round')).toBe('2')
  })

  it('shows the forgotten state to a mounted page right away', () => {
    window.localStorage.setItem('who-game-votes', JSON.stringify({ '1': 'Beide' }))
    const { result } = renderHook(() => useWhoVotes())
    expect(result.current.votes).toEqual({ '1': 'Beide' })

    act(() => syncRound('1'))

    expect(result.current.votes).toEqual({})
  })
})
