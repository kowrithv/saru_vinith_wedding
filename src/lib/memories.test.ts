import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { addMemoryEntry, deleteMemoryEntry, listMemoryEntries } from './memories'

describe('memories', () => {
  it('adds a text-only entry (photoKey null) and returns it', () => {
    const db = createDb(':memory:')
    const entry = addMemoryEntry(db, 'Anna', 'Ich erinnere mich an den Tag eures Kennenlernens.', null)

    expect(entry.id).toBeGreaterThan(0)
    expect(entry.photoKey).toBeNull()
    db.close()
  })

  it('lists entries newest first', () => {
    const db = createDb(':memory:')
    addMemoryEntry(db, 'Anna', 'Erste Erinnerung, lang genug für die Prüfung.', null)
    addMemoryEntry(db, 'Ben', 'Zweite Erinnerung, auch lang genug hier.', null)

    const entries = listMemoryEntries(db)
    expect(entries[0].name).toBe('Ben')
    expect(entries[1].name).toBe('Anna')
    db.close()
  })

  it('deletes an entry by id and returns true', () => {
    const db = createDb(':memory:')
    const entry = addMemoryEntry(db, 'Anna', 'Diese Erinnerung wird gleich gelöscht.', null)

    expect(deleteMemoryEntry(db, entry.id)).toBe(true)
    expect(listMemoryEntries(db)).toHaveLength(0)
    db.close()
  })

  it('returns false when deleting an id that does not exist', () => {
    const db = createDb(':memory:')
    expect(deleteMemoryEntry(db, 999999)).toBe(false)
    db.close()
  })
})
