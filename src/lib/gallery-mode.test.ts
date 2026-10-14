import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { getGalleryMode, setGalleryMode } from './gallery-mode'

describe('gallery mode', () => {
  // Die Galerie öffnet sich erst nach dem Kennwort (QR-Link oder Eingabe).
  it('defaults to password when never set', () => {
    const db = createDb(':memory:')
    expect(getGalleryMode(db)).toBe('password')
    db.close()
  })

  it('persists a switch to password', () => {
    const db = createDb(':memory:')
    setGalleryMode(db, 'password')
    expect(getGalleryMode(db)).toBe('password')
    db.close()
  })

  it('can switch back to public', () => {
    const db = createDb(':memory:')
    setGalleryMode(db, 'password')
    setGalleryMode(db, 'public')
    expect(getGalleryMode(db)).toBe('public')
    db.close()
  })
})
