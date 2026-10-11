import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { isWritesLocked, setWritesLocked } from './app-config'

describe('app-config writes lock', () => {
  it('defaults to unlocked when no config row exists yet', () => {
    const db = createDb(':memory:')
    expect(isWritesLocked(db)).toBe(false)
    db.close()
  })

  it('locks and unlocks, persisting across calls', () => {
    const db = createDb(':memory:')
    setWritesLocked(db, true)
    expect(isWritesLocked(db)).toBe(true)

    setWritesLocked(db, false)
    expect(isWritesLocked(db)).toBe(false)
    db.close()
  })
})
