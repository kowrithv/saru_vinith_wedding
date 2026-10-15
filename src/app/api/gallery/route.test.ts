import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from './route'
import { getDb } from '@/lib/db'
import { setFeatureLocked } from '@/lib/app-config'
import { setGalleryMode } from '@/lib/gallery-mode'
import { addGalleryPhoto, deleteGalleryPhotoRow } from '@/lib/gallery-photos'
import { createGallerySessionCookieValue, GALLERY_COOKIE_NAME } from '@/lib/gallery-auth'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue, adminCookieSecret } from '@/lib/admin-auth'

function requestWithCookies(cookies: Record<string, string>): Request {
  const headers = new Headers()
  const cookieHeader = Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ')
  if (cookieHeader) headers.set('cookie', cookieHeader)
  return new Request('http://localhost/api/gallery', { headers })
}

describe('GET /api/gallery', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalR2Base = process.env.R2_PUBLIC_BASE_URL

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.R2_PUBLIC_BASE_URL = 'https://fotos.example.de'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    process.env.R2_PUBLIC_BASE_URL = originalR2Base
  })

  it('hides photos by default: a fresh database starts in password mode', async () => {
    const db = getDb()
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1', category: 'Standesamt', isOfficial: false })

    const body = await (await GET(requestWithCookies({}))).json()
    expect(body.mode).toBe('password')
    expect(body.unlocked).toBe(false)
    expect(body.photos).toBeNull()
  })

  it('returns photos when the gallery is public, with no cookie at all', async () => {
    const db = getDb()
    setGalleryMode(db, 'public')
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1', category: 'Standesamt', isOfficial: false })

    const body = await (await GET(requestWithCookies({}))).json()
    expect(body.mode).toBe('public')
    expect(body.unlocked).toBe(true)
    expect(body.photos).toHaveLength(1)
  })

  it('hides photos when the mode is password and there is no gallery session', async () => {
    const db = getDb()
    setGalleryMode(db, 'password')
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1', category: 'Standesamt', isOfficial: false })

    const body = await (await GET(requestWithCookies({}))).json()
    expect(body.mode).toBe('password')
    expect(body.unlocked).toBe(false)
    expect(body.photos).toBeNull()
  })

  it('shows photos when the mode is password and the gallery session cookie is valid', async () => {
    const db = getDb()
    setGalleryMode(db, 'password')
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1', category: 'Standesamt', isOfficial: false })
    const cookieValue = createGallerySessionCookieValue(db)

    const body = await (await GET(requestWithCookies({ [GALLERY_COOKIE_NAME]: cookieValue }))).json()
    expect(body.unlocked).toBe(true)
    expect(body.photos).toHaveLength(1)
  })

  it('shows photos to an admin even in password mode without a gallery session cookie', async () => {
    const db = getDb()
    setGalleryMode(db, 'password')
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1', category: 'Standesamt', isOfficial: false })
    const secret = getOrCreateAdminSecret(db)
    const adminCookie = signCookieValue(Date.now() + 1000, adminCookieSecret(secret))

    const body = await (await GET(requestWithCookies({ [ADMIN_COOKIE_NAME]: adminCookie }))).json()
    expect(body.unlocked).toBe(true)
    expect(body.photos).toHaveLength(1)
  })

  it('includes category and isOfficial on each returned photo', async () => {
    const db = getDb()
    setGalleryMode(db, 'public')
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

  it('returns thumbUrl/originalUrl instead of raw storage keys', async () => {
    const db = getDb()
    setGalleryMode(db, 'public')
    addGalleryPhoto(db, {
      id: 'p1',
      thumbKey: 'gallery/p1/thumb.jpg',
      originalKey: 'gallery/p1/original.jpg',
      uploaderName: 'Anna',
      deleteTokenHash: 'h1',
      category: 'Standesamt',
      isOfficial: false,
    })

    const body = await (await GET(requestWithCookies({}))).json()
    expect(body.photos[0].thumbUrl).toBe('https://fotos.example.de/gallery/p1/thumb.jpg')
    expect(body.photos[0].originalUrl).toBe('https://fotos.example.de/gallery/p1/original.jpg')
    expect(body.photos[0]).not.toHaveProperty('thumbKey')
    expect(body.photos[0]).not.toHaveProperty('originalKey')
  })

  it('reports whether uploads are currently locked', async () => {
    const db = getDb()
    expect((await (await GET(requestWithCookies({}))).json()).uploadsLocked).toBe(false)

    setFeatureLocked(db, 'gallery_upload', true)
    expect((await (await GET(requestWithCookies({}))).json()).uploadsLocked).toBe(true)
  })

  // Die Antwort hängt vom Cookie ab und darf nie zwischengespeichert werden.
  it('marks the answer as not cacheable', async () => {
    const response = await GET(new Request('http://localhost/api/gallery'))
    expect(response.headers.get('cache-control')).toMatch(/no-store/)
  })

  describe('conditional requests (ETag)', () => {
    const photo = (id: string) => ({
      id,
      thumbKey: `gallery/${id}/thumb.jpg`,
      originalKey: `gallery/${id}/original.jpg`,
      uploaderName: 'Anna',
      deleteTokenHash: `h-${id}`,
      category: 'Standesamt',
      isOfficial: false,
    })
    const withTag = (etag: string, cookies: Record<string, string> = {}) => {
      const request = requestWithCookies(cookies)
      request.headers.set('if-none-match', etag)
      return request
    }

    it('sends an ETag with the list', async () => {
      setGalleryMode(getDb(), 'public')
      const response = await GET(requestWithCookies({}))
      expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]{24}"$/)
    })

    it('answers 304 without a body when nothing changed', async () => {
      const db = getDb()
      setGalleryMode(db, 'public')
      addGalleryPhoto(db, photo('p1'))
      const etag = (await GET(requestWithCookies({}))).headers.get('etag') as string

      const response = await GET(withTag(etag))

      expect(response.status).toBe(304)
      expect(await response.text()).toBe('')
      expect(response.headers.get('etag')).toBe(etag)
      expect(response.headers.get('cache-control')).toMatch(/no-store/)
    })

    it('sends the whole list again after a photo was added', async () => {
      const db = getDb()
      setGalleryMode(db, 'public')
      addGalleryPhoto(db, photo('p1'))
      const etag = (await GET(requestWithCookies({}))).headers.get('etag') as string

      addGalleryPhoto(db, photo('p2'))
      const response = await GET(withTag(etag))

      expect(response.status).toBe(200)
      expect((await response.json()).photos).toHaveLength(2)
      expect(response.headers.get('etag')).not.toBe(etag)
    })

    it('sends the list again after a photo was deleted', async () => {
      const db = getDb()
      setGalleryMode(db, 'public')
      addGalleryPhoto(db, photo('p1'))
      addGalleryPhoto(db, photo('p2'))
      const etag = (await GET(requestWithCookies({}))).headers.get('etag') as string

      deleteGalleryPhotoRow(db, 'p1')
      const response = await GET(withTag(etag))

      expect(response.status).toBe(200)
      expect((await response.json()).photos).toHaveLength(1)
    })

    it('notices a deleted newest photo that was replaced by a new one (same count)', async () => {
      const db = getDb()
      setGalleryMode(db, 'public')
      addGalleryPhoto(db, photo('p1'))
      addGalleryPhoto(db, photo('p2'))
      const etag = (await GET(requestWithCookies({}))).headers.get('etag') as string

      deleteGalleryPhotoRow(db, 'p2')
      addGalleryPhoto(db, photo('p3'))
      const response = await GET(withTag(etag))

      expect(response.status).toBe(200)
      expect((await response.json()).photos.map((p: { id: string }) => p.id)).toEqual(['p3', 'p1'])
    })

    it('sends the list again when uploads get locked or unlocked', async () => {
      const db = getDb()
      setGalleryMode(db, 'public')
      const etag = (await GET(requestWithCookies({}))).headers.get('etag') as string

      setFeatureLocked(db, 'gallery_upload', true)
      const response = await GET(withTag(etag))

      expect(response.status).toBe(200)
      expect((await response.json()).uploadsLocked).toBe(true)
    })

    it('does not hand a locked browser the list because it sends the ETag of an unlocked one', async () => {
      const db = getDb()
      setGalleryMode(db, 'password')
      addGalleryPhoto(db, photo('p1'))
      const session = createGallerySessionCookieValue(db)
      const unlockedTag = (await GET(requestWithCookies({ [GALLERY_COOKIE_NAME]: session }))).headers.get('etag') as string

      const response = await GET(withTag(unlockedTag))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.unlocked).toBe(false)
      expect(body.photos).toBeNull()
    })

    it('treats a wrong or malformed ETag as no ETag', async () => {
      setGalleryMode(getDb(), 'public')
      for (const tag of ['"nope"', 'W/"x"', '*', '']) {
        const response = await GET(withTag(tag))
        expect(response.status).toBe(200)
      }
    })
  })
})
