import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from './route'
import { getDb } from '@/lib/db'
import { setGalleryMode } from '@/lib/gallery-mode'
import { addGalleryPhoto } from '@/lib/gallery-photos'
import { createGallerySessionCookieValue, GALLERY_COOKIE_NAME } from '@/lib/gallery-auth'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'

function requestWithCookies(cookies: Record<string, string>): Request {
  const headers = new Headers()
  const cookieHeader = Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ')
  if (cookieHeader) headers.set('cookie', cookieHeader)
  return new Request('http://localhost/api/gallery', { headers })
}

describe('GET /api/gallery', () => {
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

  it('returns photos when the gallery is public, with no cookie at all', async () => {
    const db = getDb()
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1', category: 'Hochzeit', isOfficial: false })

    const body = await (await GET(requestWithCookies({}))).json()
    expect(body.mode).toBe('public')
    expect(body.unlocked).toBe(true)
    expect(body.photos).toHaveLength(1)
  })

  it('hides photos when the mode is password and there is no gallery session', async () => {
    const db = getDb()
    setGalleryMode(db, 'password')
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1', category: 'Hochzeit', isOfficial: false })

    const body = await (await GET(requestWithCookies({}))).json()
    expect(body.mode).toBe('password')
    expect(body.unlocked).toBe(false)
    expect(body.photos).toBeNull()
  })

  it('shows photos when the mode is password and the gallery session cookie is valid', async () => {
    const db = getDb()
    setGalleryMode(db, 'password')
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1', category: 'Hochzeit', isOfficial: false })
    const cookieValue = createGallerySessionCookieValue(db)

    const body = await (await GET(requestWithCookies({ [GALLERY_COOKIE_NAME]: cookieValue }))).json()
    expect(body.unlocked).toBe(true)
    expect(body.photos).toHaveLength(1)
  })

  it('shows photos to an admin even in password mode without a gallery session cookie', async () => {
    const db = getDb()
    setGalleryMode(db, 'password')
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1', category: 'Hochzeit', isOfficial: false })
    const secret = getOrCreateAdminSecret(db)
    const adminCookie = signCookieValue(Date.now() + 1000, secret)

    const body = await (await GET(requestWithCookies({ [ADMIN_COOKIE_NAME]: adminCookie }))).json()
    expect(body.unlocked).toBe(true)
    expect(body.photos).toHaveLength(1)
  })

  it('includes category and isOfficial on each returned photo', async () => {
    const db = getDb()
    addGalleryPhoto(db, {
      id: 'p1',
      thumbKey: 't1',
      originalKey: 'o1',
      uploaderName: 'Anna',
      deleteTokenHash: 'h1',
      category: 'Verlobung',
      isOfficial: true,
    })

    const body = await (await GET(requestWithCookies({}))).json()
    expect(body.photos[0]).toMatchObject({ category: 'Verlobung', isOfficial: true })
  })
})
