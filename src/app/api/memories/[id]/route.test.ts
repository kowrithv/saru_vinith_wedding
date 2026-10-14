import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE } from './route'
import { addMemoryEntry, listMemoryEntries } from '@/lib/memories'
import { addGalleryPhoto, getGalleryPhotoById } from '@/lib/gallery-photos'

const mockDeleteObjects = vi.fn()
vi.mock('@/lib/r2', () => ({
  deleteObjects: (keys: string[]) => mockDeleteObjects(keys),
}))
const mockPurgeCache = vi.fn()
vi.mock('@/lib/cloudflare-purge', () => ({
  purgeCache: (urls: string[]) => mockPurgeCache(urls),
}))
import { getDb } from '@/lib/db'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'

function deleteRequest(id: string, cookieValue?: string): Request {
  const headers = new Headers()
  if (cookieValue !== undefined) {
    headers.set('cookie', `${ADMIN_COOKIE_NAME}=${cookieValue}`)
  }
  return new Request(`http://localhost/api/memories/${id}`, { method: 'DELETE', headers })
}

describe('DELETE /api/memories/[id]', () => {
  const originalPath = process.env.DATABASE_PATH

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.R2_PUBLIC_BASE_URL = 'https://fotos.example.de'
    mockDeleteObjects.mockReset().mockResolvedValue(undefined)
    mockPurgeCache.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
  })

  it('deletes an entry when the request carries a valid admin cookie', async () => {
    const db = getDb()
    const entry = addMemoryEntry(db, 'Anna', 'Eine Erinnerung, die gelöscht werden soll.', null)
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await DELETE(deleteRequest(String(entry.id), cookieValue), {
      params: Promise.resolve({ id: String(entry.id) }),
    })
    expect(response.status).toBe(200)
  })

  it('rejects the request when there is no admin cookie', async () => {
    const db = getDb()
    const entry = addMemoryEntry(db, 'Anna', 'Eine Erinnerung, die bleiben soll.', null)

    const response = await DELETE(deleteRequest(String(entry.id)), {
      params: Promise.resolve({ id: String(entry.id) }),
    })
    expect(response.status).toBe(401)
  })

  it('returns 404 when deleting an id that does not exist, not a 500', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await DELETE(deleteRequest('999999', cookieValue), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(response.status).toBe(404)
  })

  it('removes the attached gallery photo (objects, row, cache) together with the entry', async () => {
    const db = getDb()
    addGalleryPhoto(db, {
      id: 'p1',
      thumbKey: 'gallery/p1/thumb.jpg',
      originalKey: 'gallery/p1/original.jpg',
      uploaderName: 'Anna',
      deleteTokenHash: 'h',
      category: 'Erinnerungen',
      isOfficial: false,
    })
    const entry = addMemoryEntry(db, 'Anna', 'Eine Erinnerung mit Foto, lang genug.', 'p1')
    const cookieValue = signCookieValue(Date.now() + 1000, getOrCreateAdminSecret(db))

    const response = await DELETE(deleteRequest(String(entry.id), cookieValue), {
      params: Promise.resolve({ id: String(entry.id) }),
    })

    expect(response.status).toBe(200)
    expect(mockDeleteObjects).toHaveBeenCalledWith(['gallery/p1/thumb.jpg', 'gallery/p1/original.jpg'])
    expect(getGalleryPhotoById(db, 'p1')).toBeUndefined()
    expect(mockPurgeCache).toHaveBeenCalledWith([
      'https://fotos.example.de/gallery/p1/thumb.jpg',
      'https://fotos.example.de/gallery/p1/original.jpg',
    ])
    expect(listMemoryEntries(db)).toHaveLength(0)
  })

  it('keeps the entry when the photo cannot be removed, so the admin can try again', async () => {
    const db = getDb()
    addGalleryPhoto(db, {
      id: 'p1',
      thumbKey: 'gallery/p1/thumb.jpg',
      originalKey: 'gallery/p1/original.jpg',
      uploaderName: 'Anna',
      deleteTokenHash: 'h',
      category: 'Erinnerungen',
      isOfficial: false,
    })
    const entry = addMemoryEntry(db, 'Anna', 'Eine Erinnerung mit Foto, lang genug.', 'p1')
    const cookieValue = signCookieValue(Date.now() + 1000, getOrCreateAdminSecret(db))
    mockDeleteObjects.mockRejectedValueOnce(new Error('R2 nicht erreichbar'))

    await expect(
      DELETE(deleteRequest(String(entry.id), cookieValue), { params: Promise.resolve({ id: String(entry.id) }) })
    ).rejects.toThrow()

    expect(listMemoryEntries(db)).toHaveLength(1)
  })

  it('does not touch R2 for an entry without a photo', async () => {
    const db = getDb()
    const entry = addMemoryEntry(db, 'Anna', 'Nur Text, lang genug für die Prüfung.', null)
    const cookieValue = signCookieValue(Date.now() + 1000, getOrCreateAdminSecret(db))

    await DELETE(deleteRequest(String(entry.id), cookieValue), { params: Promise.resolve({ id: String(entry.id) }) })

    expect(mockDeleteObjects).not.toHaveBeenCalled()
  })
})
