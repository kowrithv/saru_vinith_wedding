import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { isFeatureLocked, setFeatureLocked } from './app-config'

describe('app-config feature locks', () => {
  it('defaults to unlocked for each feature independently', () => {
    const db = createDb(':memory:')
    expect(isFeatureLocked(db, 'guestbook')).toBe(false)
    expect(isFeatureLocked(db, 'memories')).toBe(false)
    expect(isFeatureLocked(db, 'who_votes')).toBe(false)
    db.close()
  })

  it('locks one feature without affecting the other two', () => {
    const db = createDb(':memory:')
    setFeatureLocked(db, 'guestbook', true)

    expect(isFeatureLocked(db, 'guestbook')).toBe(true)
    expect(isFeatureLocked(db, 'memories')).toBe(false)
    expect(isFeatureLocked(db, 'who_votes')).toBe(false)
    db.close()
  })

  it('locks and unlocks the who_votes feature independently of the others', () => {
    const db = createDb(':memory:')
    setFeatureLocked(db, 'guestbook', true)
    setFeatureLocked(db, 'who_votes', true)
    setFeatureLocked(db, 'who_votes', false)

    expect(isFeatureLocked(db, 'guestbook')).toBe(true)
    expect(isFeatureLocked(db, 'memories')).toBe(false)
    expect(isFeatureLocked(db, 'who_votes')).toBe(false)
    db.close()
  })
})
