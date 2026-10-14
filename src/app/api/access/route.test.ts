import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from './route'
import { getDb } from '@/lib/db'
import { GALLERY_COOKIE_NAME, createGallerySessionCookieValue } from '@/lib/gallery-auth'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'

function requestWithCookies(cookies: Record<string, string>): Request {
  const headers = new Headers()
  const cookieHeader = Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ')
  if (cookieHeader) headers.set('cookie', cookieHeader)
  return new Request('http://localhost/api/access', { headers })
}

describe('GET /api/access', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalPassword = process.env.UPLOAD_PASSWORD_EMPFANG

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.UPLOAD_PASSWORD_EMPFANG = 'empfang-secret'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    process.env.UPLOAD_PASSWORD_EMPFANG = originalPassword
  })

  it('reports locked without any cookie', async () => {
    const response = await GET(requestWithCookies({}))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ unlocked: false })
  })

  it('reports unlocked with a valid guest session', async () => {
    const cookie = createGallerySessionCookieValue(getDb())
    const response = await GET(requestWithCookies({ [GALLERY_COOKIE_NAME]: cookie }))
    expect(await response.json()).toEqual({ unlocked: true })
  })

  it('reports locked with an expired or foreign cookie', async () => {
    const db = getDb()
    const stale = createGallerySessionCookieValue(db, Date.now() - 31 * 24 * 60 * 60 * 1000)
    expect(await (await GET(requestWithCookies({ [GALLERY_COOKIE_NAME]: stale }))).json()).toEqual({ unlocked: false })
    expect(await (await GET(requestWithCookies({ [GALLERY_COOKIE_NAME]: 'x.y' }))).json()).toEqual({ unlocked: false })
  })

  it('reports unlocked for an admin session', async () => {
    const secret = getOrCreateAdminSecret(getDb())
    const adminCookie = signCookieValue(Date.now() + 1000, secret)
    const response = await GET(requestWithCookies({ [ADMIN_COOKIE_NAME]: adminCookie }))
    expect(await response.json()).toEqual({ unlocked: true })
  })

  it('is never cached', async () => {
    const response = await GET(requestWithCookies({}))
    expect(response.headers.get('cache-control')).toMatch(/no-store/)
  })
})
