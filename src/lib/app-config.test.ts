import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { getConfigValue, isFeatureLocked, LOCKABLE_FEATURES, setConfigValue, setFeatureLocked } from './app-config'

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

describe('LOCKABLE_FEATURES', () => {
  it('contains the three write locks, the gallery upload and the memory photos', () => {
    expect([...LOCKABLE_FEATURES]).toEqual(['guestbook', 'memories', 'who_votes', 'gallery_upload', 'memory_photos'])
  })

  it('locks and unlocks gallery_upload independently of the other features', () => {
    const db = createDb(':memory:')
    setFeatureLocked(db, 'gallery_upload', true)
    expect(isFeatureLocked(db, 'gallery_upload')).toBe(true)
    expect(isFeatureLocked(db, 'guestbook')).toBe(false)
    setFeatureLocked(db, 'gallery_upload', false)
    expect(isFeatureLocked(db, 'gallery_upload')).toBe(false)
    db.close()
  })
})

describe('config values', () => {
  it('returns undefined for an unknown key and round-trips a value', () => {
    const db = createDb(':memory:')
    expect(getConfigValue(db, 'alert_last_sent:test')).toBeUndefined()
    setConfigValue(db, 'alert_last_sent:test', '123')
    expect(getConfigValue(db, 'alert_last_sent:test')).toBe('123')
    setConfigValue(db, 'alert_last_sent:test', '456')
    expect(getConfigValue(db, 'alert_last_sent:test')).toBe('456')
    db.close()
  })
})

describe('memory_photos lock', () => {
  it('is unlocked by default and independent of the memories text lock', () => {
    const db = createDb(':memory:')
    expect(isFeatureLocked(db, 'memory_photos')).toBe(false)

    setFeatureLocked(db, 'memory_photos', true)
    expect(isFeatureLocked(db, 'memory_photos')).toBe(true)
    expect(isFeatureLocked(db, 'memories')).toBe(false)
    expect(isFeatureLocked(db, 'gallery_upload')).toBe(false)
    db.close()
  })
})
