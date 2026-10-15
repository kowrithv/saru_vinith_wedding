import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { forgetResultsKey, takeResultsKey } from './who-results-key'

const KEY = 'ab'.repeat(32)

describe('takeResultsKey', () => {
  beforeEach(() => {
    forgetResultsKey()
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/wer-von-uns/ergebnisse')
  })

  afterEach(() => {
    forgetResultsKey()
    window.history.replaceState(null, '', '/')
  })

  it('returns null when there is no key anywhere', () => {
    expect(takeResultsKey()).toBeNull()
  })

  it('takes the key from the fragment and removes it from the address', () => {
    window.history.replaceState(null, '', `/wer-von-uns/ergebnisse#k=${KEY}`)

    expect(takeResultsKey()).toBe(KEY)
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/wer-von-uns/ergebnisse')
  })

  it('remembers the key for a reload in the same tab', () => {
    window.history.replaceState(null, '', `/wer-von-uns/ergebnisse#k=${KEY}`)
    takeResultsKey()
    forgetResultsKey()

    expect(takeResultsKey()).toBe(KEY)
  })

  it('ignores a key that is not 64 hex characters', () => {
    window.history.replaceState(null, '', '/wer-von-uns/ergebnisse#k=zu-kurz')

    expect(takeResultsKey()).toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('keeps other fragment parts', () => {
    window.history.replaceState(null, '', `/wer-von-uns/ergebnisse#k=${KEY}&x=1`)

    takeResultsKey()

    expect(window.location.hash).toBe('#x=1')
  })
})
