import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb } from './db'
import { getGalleryPhotoById } from './gallery-photos'
import { checkUploadedObjects, storeUploadedPhoto } from './gallery-upload-complete'
import type { TicketPayload } from './upload-ticket'

const mockHeadObject = vi.fn()
vi.mock('@/lib/r2', () => ({
  headObject: (key: string) => mockHeadObject(key),
}))

function payload(overrides: Partial<TicketPayload> = {}): TicketPayload {
  return {
    photoId: 'photo-1',
    thumbKey: 'gallery/photo-1/thumb.jpg',
    originalKey: 'gallery/photo-1/original.jpg',
    thumbMaxSize: 50_000,
    originalSize: 4_000_000,
    expiresAt: Date.now() + 60_000,
    category: 'Erinnerungen',
    isOfficial: false,
    ...overrides,
  }
}

describe('checkUploadedObjects', () => {
  beforeEach(() => {
    mockHeadObject.mockReset()
  })

  it('accepts a ticket whose objects exist with the signed sizes', async () => {
    mockHeadObject.mockImplementation(async (key: string) =>
      key.endsWith('thumb.jpg') ? { size: 40_000 } : { size: 4_000_000 }
    )
    await expect(checkUploadedObjects(payload())).resolves.toEqual({ ok: true })
  })

  it('rejects a missing or oversized preview', async () => {
    mockHeadObject.mockImplementation(async (key: string) =>
      key.endsWith('thumb.jpg') ? null : { size: 4_000_000 }
    )
    expect(await checkUploadedObjects(payload())).toMatchObject({ ok: false, status: 400 })

    mockHeadObject.mockImplementation(async (key: string) =>
      key.endsWith('thumb.jpg') ? { size: 50_001 } : { size: 4_000_000 }
    )
    expect(await checkUploadedObjects(payload())).toMatchObject({ ok: false, status: 400 })
  })

  it('rejects an original that is missing or has a different size', async () => {
    mockHeadObject.mockImplementation(async (key: string) =>
      key.endsWith('thumb.jpg') ? { size: 40_000 } : { size: 1 }
    )
    expect(await checkUploadedObjects(payload())).toMatchObject({ ok: false, status: 400 })
  })
})

describe('storeUploadedPhoto', () => {
  it('stores the photo with the uploader name and returns a delete token (only its hash is stored)', () => {
    const db = createDb(':memory:')
    const result = storeUploadedPhoto(db, payload(), 'Anna')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.photo).toMatchObject({ id: 'photo-1', uploaderName: 'Anna', category: 'Erinnerungen', isOfficial: false })
    expect(result.deleteToken).toMatch(/^[0-9a-f]{64}$/)

    const stored = getGalleryPhotoById(db, 'photo-1')
    expect(stored?.deleteTokenHash).not.toBe(result.deleteToken)
    db.close()
  })

  it('reports a ticket that was already used instead of throwing', () => {
    const db = createDb(':memory:')
    storeUploadedPhoto(db, payload(), 'Anna')

    expect(storeUploadedPhoto(db, payload(), 'Anna')).toEqual({ ok: false, status: 409, error: expect.any(String) })
    db.close()
  })
})
