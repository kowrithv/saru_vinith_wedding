import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb } from './db'
import { addGalleryPhoto, getGalleryPhotoById } from './gallery-photos'
import { removeGalleryPhoto } from './gallery-photo-removal'

const mockDeleteObjects = vi.fn()
vi.mock('@/lib/r2', () => ({
  deleteObjects: (keys: string[]) => mockDeleteObjects(keys),
}))
const mockPurgeCache = vi.fn()
vi.mock('@/lib/cloudflare-purge', () => ({
  purgeCache: (urls: string[]) => mockPurgeCache(urls),
}))

describe('removeGalleryPhoto', () => {
  beforeEach(() => {
    mockDeleteObjects.mockReset().mockResolvedValue(undefined)
    mockPurgeCache.mockReset().mockResolvedValue(undefined)
    process.env.R2_PUBLIC_BASE_URL = 'https://fotos.example.de'
  })

  it('deletes both objects, the row and purges both public URLs', async () => {
    const db = createDb(':memory:')
    const photo = addGalleryPhoto(db, {
      id: 'p1',
      thumbKey: 'gallery/p1/thumb.jpg',
      originalKey: 'gallery/p1/original.jpg',
      uploaderName: 'Anna',
      deleteTokenHash: 'h',
      category: 'Standesamt',
      isOfficial: false,
    })

    await removeGalleryPhoto(db, photo)

    expect(mockDeleteObjects).toHaveBeenCalledWith(['gallery/p1/thumb.jpg', 'gallery/p1/original.jpg'])
    expect(getGalleryPhotoById(db, 'p1')).toBeUndefined()
    expect(mockPurgeCache).toHaveBeenCalledWith([
      'https://fotos.example.de/gallery/p1/thumb.jpg',
      'https://fotos.example.de/gallery/p1/original.jpg',
    ])
    db.close()
  })
})
