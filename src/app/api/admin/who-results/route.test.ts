import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'
import { getDb } from '@/lib/db'
import { ADMIN_COOKIE_NAME, adminCookieSecret, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'
import { areResultsReleased, resultsKey } from '@/lib/who-results'

function adminHeaders(): Record<string, string> {
  const cookie = signCookieValue(Date.now() + 60_000, adminCookieSecret(getOrCreateAdminSecret(getDb())))
  return { cookie: `${ADMIN_COOKIE_NAME}=${cookie}` }
}

function request(method: 'GET' | 'POST', headers: Record<string, string> = {}, body?: unknown): Request {
  return new Request('http://localhost/api/admin/who-results', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('/api/admin/who-results', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalSecret = process.env.ADMIN_SECRET
  const originalPassword = process.env.ADMIN_PASSWORD

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.ADMIN_SECRET = 'test-admin-secret'
    process.env.ADMIN_PASSWORD = 'test-admin-password'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    if (originalSecret === undefined) delete process.env.ADMIN_SECRET
    else process.env.ADMIN_SECRET = originalSecret
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD
    else process.env.ADMIN_PASSWORD = originalPassword
  })

  it('GET requires an admin session', async () => {
    expect((await GET(request('GET'))).status).toBe(401)
  })

  it('GET returns the state and the key for the DJ link', async () => {
    const response = await GET(request('GET', adminHeaders()))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ released: false, key: resultsKey(getDb()) })
  })

  it('POST requires an admin session and changes nothing without one', async () => {
    const response = await POST(request('POST', {}, { released: true }))

    expect(response.status).toBe(401)
    expect(areResultsReleased(getDb())).toBe(false)
  })

  it('POST releases and hides the results', async () => {
    const released = await POST(request('POST', adminHeaders(), { released: true }))
    expect(released.status).toBe(200)
    expect((await released.json()).released).toBe(true)
    expect(areResultsReleased(getDb())).toBe(true)

    const hidden = await POST(request('POST', adminHeaders(), { released: false }))
    expect((await hidden.json()).released).toBe(false)
    expect(areResultsReleased(getDb())).toBe(false)
  })

  it('POST rejects a malformed body', async () => {
    const response = await POST(request('POST', adminHeaders(), { released: 'yes' }))
    expect(response.status).toBe(400)
  })
})
