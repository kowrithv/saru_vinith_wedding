import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toGalleryPhotoView } from './gallery-photo-view'
import type { GalleryPhoto } from './gallery-photos'

describe('toGalleryPhotoView', () => {
  const originalBase = process.env.R2_PUBLIC_BASE_URL

  beforeEach(() => {
    process.env.R2_PUBLIC_BASE_URL = 'https://fotos.example.de'
  })

  afterEach(() => {
    process.env.R2_PUBLIC_BASE_URL = originalBase
  })

  it('builds absolute thumb/original URLs and drops the raw keys', () => {
    const photo: GalleryPhoto = {
      id: 'p1',
      thumbKey: 'gallery/p1/thumb.jpg',
      originalKey: 'gallery/p1/original.jpg',
      uploaderName: 'Anna',
      category: 'Hochzeit',
      isOfficial: false,
      createdAt: '2026-10-12T10:00:00.000Z',
    }

    const view = toGalleryPhotoView(photo)

    expect(view).toEqual({
      id: 'p1',
      uploaderName: 'Anna',
      category: 'Hochzeit',
      isOfficial: false,
      createdAt: '2026-10-12T10:00:00.000Z',
      thumbUrl: 'https://fotos.example.de/gallery/p1/thumb.jpg',
      originalUrl: 'https://fotos.example.de/gallery/p1/original.jpg',
    })
    expect(view).not.toHaveProperty('thumbKey')
    expect(view).not.toHaveProperty('originalKey')
  })
})
