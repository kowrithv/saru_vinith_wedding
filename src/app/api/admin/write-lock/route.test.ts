import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'
import { getDb } from '@/lib/db'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue, adminCookieSecret } from '@/lib/admin-auth'

function requestWithCookie(method: string, cookieValue?: string, body?: unknown): Request {
  const headers = new Headers()
  if (cookieValue !== undefined) {
    headers.set('cookie', `${ADMIN_COOKIE_NAME}=${cookieValue}`)
  }
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  return new Request('http://localhost/api/admin/write-lock', {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('/api/admin/write-lock', () => {
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

  it('GET rejects a request without a valid admin cookie', async () => {
    const response = await GET(requestWithCookie('GET'))
    expect(response.status).toBe(401)
  })

  it('GET returns all five lock states (false by default) for an admin', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, adminCookieSecret(secret))

    const response = await GET(requestWithCookie('GET', cookieValue))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.locks).toEqual({ guestbook: false, memories: false, who_votes: false, gallery_upload: false, memory_photos: false })
  })

  it('POST rejects a request without a valid admin cookie', async () => {
    const response = await POST(requestWithCookie('POST', undefined, { feature: 'guestbook', locked: true }))
    expect(response.status).toBe(401)
  })

  it('POST updates only the targeted feature, and a subsequent GET reflects it', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, adminCookieSecret(secret))

    const postResponse = await POST(
      requestWithCookie('POST', cookieValue, { feature: 'guestbook', locked: true })
    )
    expect(postResponse.status).toBe(200)
    const postBody = await postResponse.json()
    expect(postBody.locks).toEqual({ guestbook: true, memories: false, who_votes: false, gallery_upload: false, memory_photos: false })

    const getResponse = await GET(requestWithCookie('GET', cookieValue))
    const getBody = await getResponse.json()
    expect(getBody.locks).toEqual({ guestbook: true, memories: false, who_votes: false, gallery_upload: false, memory_photos: false })
  })

  it('POST rejects an unknown feature value', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, adminCookieSecret(secret))

    const response = await POST(
      requestWithCookie('POST', cookieValue, { feature: 'gallery', locked: true })
    )
    expect(response.status).toBe(400)
  })

  it.each(['guestbook', 'memories', 'who_votes', 'gallery_upload', 'memory_photos'] as const)(
    'POST locks only %s and leaves the other features alone',
    async (feature) => {
      const db = getDb()
      const secret = getOrCreateAdminSecret(db)
      const cookieValue = signCookieValue(Date.now() + 1000, adminCookieSecret(secret))

      const response = await POST(requestWithCookie('POST', cookieValue, { feature, locked: true }))
      expect(response.status).toBe(200)
      const { locks } = await response.json()

      expect(locks[feature]).toBe(true)
      expect(Object.values(locks).filter(Boolean)).toHaveLength(1)
    }
  )
})
