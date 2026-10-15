import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { addGalleryPhoto, listGalleryPhotos, getGalleryPhotoById, deleteGalleryPhotoRow } from './gallery-photos'

function photoInput(overrides: Partial<Parameters<typeof addGalleryPhoto>[1]> = {}) {
  return {
    id: 'photo-1',
    thumbKey: 't1',
    originalKey: 'o1',
    uploaderName: 'Anna',
    deleteTokenHash: 'h1',
    category: 'Standesamt',
    isOfficial: false,
    ...overrides,
  }
}

describe('gallery photos', () => {
  it('adds a photo and returns it without the delete-token hash', () => {
    const db = createDb(':memory:')
    const photo = addGalleryPhoto(db, photoInput({
      id: 'photo-1',
      thumbKey: 'gallery/photo-1/thumb.jpg',
      originalKey: 'gallery/photo-1/original.jpg',
    }))
    expect(photo).toEqual({
      id: 'photo-1',
      thumbKey: 'gallery/photo-1/thumb.jpg',
      originalKey: 'gallery/photo-1/original.jpg',
      uploaderName: 'Anna',
      category: 'Standesamt',
      isOfficial: false,
      createdAt: expect.any(String),
    })
    expect(photo).not.toHaveProperty('deleteTokenHash')
    db.close()
  })

  it('stores and returns isOfficial as a real boolean, not 0/1, and keeps the given category', () => {
    const db = createDb(':memory:')
    const photo = addGalleryPhoto(db, photoInput({ category: 'Party', isOfficial: true }))
    expect(photo.isOfficial).toBe(true)
    expect(photo.category).toBe('Party')
    db.close()
  })

  it('lists photos newest first', () => {
    const db = createDb(':memory:')
    addGalleryPhoto(db, photoInput({ id: 'photo-1' }))
    addGalleryPhoto(db, photoInput({ id: 'photo-2' }))

    expect(listGalleryPhotos(db).map((p) => p.id)).toEqual(['photo-2', 'photo-1'])
    db.close()
  })

  it('getGalleryPhotoById includes the delete-token hash', () => {
    const db = createDb(':memory:')
    addGalleryPhoto(db, photoInput({ deleteTokenHash: 'secret-hash' }))

    expect(getGalleryPhotoById(db, 'photo-1')?.deleteTokenHash).toBe('secret-hash')
    db.close()
  })

  it('getGalleryPhotoById returns undefined for an unknown id', () => {
    const db = createDb(':memory:')
    expect(getGalleryPhotoById(db, 'does-not-exist')).toBeUndefined()
    db.close()
  })

  it('deletes a photo row and reports success', () => {
    const db = createDb(':memory:')
    addGalleryPhoto(db, photoInput())

    expect(deleteGalleryPhotoRow(db, 'photo-1')).toBe(true)
    expect(listGalleryPhotos(db)).toEqual([])
    db.close()
  })

  it('reports failure when deleting an id that does not exist', () => {
    const db = createDb(':memory:')
    expect(deleteGalleryPhotoRow(db, 'does-not-exist')).toBe(false)
    db.close()
  })
})
