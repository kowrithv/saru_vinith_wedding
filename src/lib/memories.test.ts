import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { addGalleryPhoto, deleteGalleryPhotoRow } from './gallery-photos'
import { addMemoryEntry, deleteMemoryEntry, getMemoryEntry, listMemoryEntries } from './memories'

function addPhoto(db: ReturnType<typeof createDb>, id = 'photo-1') {
  return addGalleryPhoto(db, {
    id,
    thumbKey: `gallery/${id}/thumb.jpg`,
    originalKey: `gallery/${id}/original.jpg`,
    uploaderName: 'Anna',
    deleteTokenHash: 'hash',
    category: 'Erinnerungen',
    isOfficial: false,
  })
}

describe('memories', () => {
  it('adds a text-only entry without a photo and returns it', () => {
    const db = createDb(':memory:')
    const entry = addMemoryEntry(db, 'Anna', 'Ich erinnere mich an den Tag eures Kennenlernens.', null)

    expect(entry.id).toBeGreaterThan(0)
    expect(entry.photo).toBeNull()
    db.close()
  })

  it('adds an entry that points to a gallery photo and returns the photo keys', () => {
    const db = createDb(':memory:')
    addPhoto(db)
    const entry = addMemoryEntry(db, 'Anna', 'Mit einem Foto von damals, lang genug.', 'photo-1')

    expect(entry.photo).toEqual({
      id: 'photo-1',
      thumbKey: 'gallery/photo-1/thumb.jpg',
      originalKey: 'gallery/photo-1/original.jpg',
    })
    db.close()
  })

  it('lists entries newest first, each with its photo if there is one', () => {
    const db = createDb(':memory:')
    addPhoto(db)
    addMemoryEntry(db, 'Anna', 'Erste Erinnerung, lang genug für die Prüfung.', 'photo-1')
    addMemoryEntry(db, 'Ben', 'Zweite Erinnerung, auch lang genug hier.', null)

    const entries = listMemoryEntries(db)
    expect(entries[0].name).toBe('Ben')
    expect(entries[0].photo).toBeNull()
    expect(entries[1].name).toBe('Anna')
    expect(entries[1].photo?.id).toBe('photo-1')
    db.close()
  })

  it('shows the text without a photo once the gallery photo was deleted', () => {
    const db = createDb(':memory:')
    addPhoto(db)
    const entry = addMemoryEntry(db, 'Anna', 'Das Foto wird später gelöscht, der Text bleibt.', 'photo-1')

    deleteGalleryPhotoRow(db, 'photo-1')

    expect(listMemoryEntries(db)[0].photo).toBeNull()
    expect(getMemoryEntry(db, entry.id)?.photo).toBeNull()
    db.close()
  })

  it('gets one entry with its photo id, or undefined for an unknown id', () => {
    const db = createDb(':memory:')
    addPhoto(db)
    const entry = addMemoryEntry(db, 'Anna', 'Eine Erinnerung mit Foto, lang genug.', 'photo-1')

    expect(getMemoryEntry(db, entry.id)?.photo?.id).toBe('photo-1')
    expect(getMemoryEntry(db, 999999)).toBeUndefined()
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
