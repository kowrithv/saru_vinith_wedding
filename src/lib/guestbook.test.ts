import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { addGuestbookEntry, deleteGuestbookEntry, listGuestbookEntries } from './guestbook'

describe('guestbook', () => {
  it('adds an entry and returns it with an id and createdAt', () => {
    const db = createDb(':memory:')
    const entry = addGuestbookEntry(db, 'Anna', 'Wir freuen uns so für euch!')

    expect(entry.id).toBeGreaterThan(0)
    expect(entry.name).toBe('Anna')
    expect(entry.message).toBe('Wir freuen uns so für euch!')
    expect(entry.createdAt).toEqual(expect.any(String))
    db.close()
  })

  it('lists entries newest first', () => {
    const db = createDb(':memory:')
    addGuestbookEntry(db, 'Anna', 'Erste Nachricht hier im Buch.')
    addGuestbookEntry(db, 'Ben', 'Zweite Nachricht, kurz danach.')

    const entries = listGuestbookEntries(db)
    expect(entries).toHaveLength(2)
    expect(entries[0].name).toBe('Ben')
    expect(entries[1].name).toBe('Anna')
    db.close()
  })

  it('deletes an entry by id and returns true', () => {
    const db = createDb(':memory:')
    const entry = addGuestbookEntry(db, 'Anna', 'Diese Nachricht wird gelöscht.')

    expect(deleteGuestbookEntry(db, entry.id)).toBe(true)
    expect(listGuestbookEntries(db)).toHaveLength(0)
    db.close()
  })

  it('returns false when deleting an id that does not exist', () => {
    const db = createDb(':memory:')
    expect(deleteGuestbookEntry(db, 999999)).toBe(false)
    db.close()
  })
})
