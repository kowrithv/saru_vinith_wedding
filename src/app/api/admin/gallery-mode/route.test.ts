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
  return new Request('http://localhost/api/admin/gallery-mode', {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('/api/admin/gallery-mode', () => {
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

  it('GET returns password by default', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, adminCookieSecret(secret))

    const response = await GET(requestWithCookie('GET', cookieValue))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ mode: 'password' })
  })

  it('POST switches the mode and a subsequent GET reflects it', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, adminCookieSecret(secret))

    const postResponse = await POST(requestWithCookie('POST', cookieValue, { mode: 'password' }))
    expect(postResponse.status).toBe(200)
    expect(await postResponse.json()).toEqual({ mode: 'password' })

    const getResponse = await GET(requestWithCookie('GET', cookieValue))
    expect(await getResponse.json()).toEqual({ mode: 'password' })
  })

  it('POST rejects an unknown mode value', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, adminCookieSecret(secret))

    const response = await POST(requestWithCookie('POST', cookieValue, { mode: 'secret-club' }))
    expect(response.status).toBe(400)
  })

  it('POST rejects a request without a valid admin cookie', async () => {
    const response = await POST(requestWithCookie('POST', undefined, { mode: 'password' }))
    expect(response.status).toBe(401)
  })
})
