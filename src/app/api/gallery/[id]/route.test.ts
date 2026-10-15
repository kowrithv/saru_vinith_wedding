import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { DELETE } from './route'
import { getDb } from '@/lib/db'
import { addGalleryPhoto } from '@/lib/gallery-photos'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'

vi.mock('@/lib/r2', () => ({ deleteObjects: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/cloudflare-purge', () => ({ purgeCache: vi.fn().mockResolvedValue(undefined) }))

function deleteRequest(id: string, options: { cookieValue?: string; deleteToken?: string } = {}): Request {
  const headers = new Headers()
  if (options.cookieValue) headers.set('cookie', `${ADMIN_COOKIE_NAME}=${options.cookieValue}`)
  if (options.deleteToken !== undefined) headers.set('Content-Type', 'application/json')
  return new Request(`http://localhost/api/gallery/${id}`, {
    method: 'DELETE',
    headers,
    body: options.deleteToken !== undefined ? JSON.stringify({ deleteToken: options.deleteToken }) : undefined,
  })
}

function seedPhoto(db: ReturnType<typeof getDb>, id: string, deleteToken: string) {
  const deleteTokenHash = createHash('sha256').update(deleteToken, 'utf8').digest('hex')
  addGalleryPhoto(db, {
    id,
    thumbKey: `gallery/${id}/thumb.jpg`,
    originalKey: `gallery/${id}/original.jpg`,
    uploaderName: 'Anna',
    deleteTokenHash,
    category: 'Standesamt',
    isOfficial: false,
  })
}

describe('DELETE /api/gallery/[id]', () => {
  const originalPath = process.env.DATABASE_PATH

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
  })

  it('deletes the photo when the correct delete token is given', async () => {
    const db = getDb()
    seedPhoto(db, 'photo-1', 'the-real-token')

    const response = await DELETE(deleteRequest('photo-1', { deleteToken: 'the-real-token' }), {
      params: Promise.resolve({ id: 'photo-1' }),
    })
    expect(response.status).toBe(200)
  })

  it('rejects a delete token that belongs to a different photo', async () => {
    const db = getDb()
    seedPhoto(db, 'photo-1', 'token-for-photo-1')
    seedPhoto(db, 'photo-2', 'token-for-photo-2')

    const response = await DELETE(deleteRequest('photo-1', { deleteToken: 'token-for-photo-2' }), {
      params: Promise.resolve({ id: 'photo-1' }),
    })
    expect(response.status).toBe(403)
  })

  it('rejects a missing delete token for a guest request', async () => {
    const db = getDb()
    seedPhoto(db, 'photo-1', 'the-real-token')

    const response = await DELETE(deleteRequest('photo-1'), {
      params: Promise.resolve({ id: 'photo-1' }),
    })
    expect(response.status).toBe(403)
  })

  it('lets an admin delete without any delete token', async () => {
    const db = getDb()
    seedPhoto(db, 'photo-1', 'the-real-token')
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await DELETE(deleteRequest('photo-1', { cookieValue }), {
      params: Promise.resolve({ id: 'photo-1' }),
    })
    expect(response.status).toBe(200)
  })

  it('returns 404 for an id that does not exist', async () => {
    getDb()
    const response = await DELETE(deleteRequest('does-not-exist', { deleteToken: 'whatever' }), {
      params: Promise.resolve({ id: 'does-not-exist' }),
    })
    expect(response.status).toBe(404)
  })
})
