import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'
import { getDb } from '@/lib/db'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'

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

  it('GET returns the current lock status (false by default) for an admin', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await GET(requestWithCookie('GET', cookieValue))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.locked).toBe(false)
  })

  it('POST rejects a request without a valid admin cookie', async () => {
    const response = await POST(requestWithCookie('POST', undefined, { locked: true }))
    expect(response.status).toBe(401)
  })

  it('POST updates the lock, and a subsequent GET reflects it', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const postResponse = await POST(requestWithCookie('POST', cookieValue, { locked: true }))
    expect(postResponse.status).toBe(200)

    const getResponse = await GET(requestWithCookie('GET', cookieValue))
    const body = await getResponse.json()
    expect(body.locked).toBe(true)
  })
})
