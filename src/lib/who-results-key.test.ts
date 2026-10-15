import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearResultsKey,
  forgetResultsKey,
  rememberResultsKey,
  subscribeResultsKey,
  takeResultsKey,
} from './who-results-key'

const KEY = 'kirsche'

describe('results key in the browser', () => {
  beforeEach(() => {
    forgetResultsKey()
    window.localStorage.clear()
    window.history.replaceState(null, '', '/dj')
  })

  afterEach(() => {
    forgetResultsKey()
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('returns null when there is no key anywhere', () => {
    expect(takeResultsKey()).toBeNull()
  })

  it('takes the key from the fragment and removes it from the address', () => {
    window.history.replaceState(null, '', `/dj#k=${KEY}`)

    expect(takeResultsKey()).toBe(KEY)
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/dj')
  })

  it('remembers the key from the link for a later visit', () => {
    window.history.replaceState(null, '', `/dj#k=${KEY}`)
    takeResultsKey()
    forgetResultsKey()

    expect(takeResultsKey()).toBe(KEY)
  })

  it('ignores a fragment key that is not a word of letters', () => {
    window.history.replaceState(null, '', '/dj#k=zu-kurz')

    expect(takeResultsKey()).toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('keeps other fragment parts', () => {
    window.history.replaceState(null, '', `/dj#k=${KEY}&x=1`)

    takeResultsKey()

    expect(window.location.hash).toBe('#x=1')
  })

  describe('typed in', () => {
    it('stores a typed word in its basic form and tells the listeners', () => {
      const listener = vi.fn()
      const unsubscribe = subscribeResultsKey(listener)

      expect(rememberResultsKey('  Kirsche ')).toBe(true)

      expect(takeResultsKey()).toBe('kirsche')
      expect(listener).toHaveBeenCalledTimes(1)
      forgetResultsKey()
      expect(takeResultsKey()).toBe('kirsche')
      unsubscribe()
    })

    it('refuses an input that cannot be a word', () => {
      expect(rememberResultsKey('ab')).toBe(false)
      expect(rememberResultsKey('kirsche 7')).toBe(false)
      expect(takeResultsKey()).toBeNull()
    })

    it('forgets a rejected word', () => {
      rememberResultsKey(KEY)

      clearResultsKey()

      expect(takeResultsKey()).toBeNull()
      forgetResultsKey()
      expect(takeResultsKey()).toBeNull()
    })
  })
})
