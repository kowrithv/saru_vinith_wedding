import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { addGalleryPhoto, listGalleryPhotos, getGalleryPhotoById, deleteGalleryPhotoRow } from './gallery-photos'

describe('gallery photos', () => {
  it('adds a photo and returns it without the delete-token hash', () => {
    const db = createDb(':memory:')
    const photo = addGalleryPhoto(db, {
      id: 'photo-1',
      thumbKey: 'gallery/photo-1/thumb.jpg',
      originalKey: 'gallery/photo-1/original.jpg',
      uploaderName: 'Anna',
      deleteTokenHash: 'hash-1',
    })
    expect(photo).toEqual({
      id: 'photo-1',
      thumbKey: 'gallery/photo-1/thumb.jpg',
      originalKey: 'gallery/photo-1/original.jpg',
      uploaderName: 'Anna',
      createdAt: expect.any(String),
    })
    expect(photo).not.toHaveProperty('deleteTokenHash')
    db.close()
  })

  it('lists photos newest first', () => {
    const db = createDb(':memory:')
    addGalleryPhoto(db, { id: 'photo-1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1' })
    addGalleryPhoto(db, { id: 'photo-2', thumbKey: 't2', originalKey: 'o2', uploaderName: 'Ben', deleteTokenHash: 'h2' })

    expect(listGalleryPhotos(db).map((p) => p.id)).toEqual(['photo-2', 'photo-1'])
    db.close()
  })

  it('getGalleryPhotoById includes the delete-token hash', () => {
    const db = createDb(':memory:')
    addGalleryPhoto(db, { id: 'photo-1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'secret-hash' })

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
    addGalleryPhoto(db, { id: 'photo-1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1' })

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
