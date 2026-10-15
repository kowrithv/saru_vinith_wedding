import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'
import { getDb } from '@/lib/db'
import { ADMIN_COOKIE_NAME, adminCookieSecret, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'
import { getWhoPhase, resultsKey } from '@/lib/who-results'

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

  it('GET returns the phase and the word for the DJ', async () => {
    const response = await GET(request('GET', adminHeaders()))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ phase: 'voting', key: resultsKey(getDb()) })
  })

  it('POST requires an admin session and changes nothing without one', async () => {
    const response = await POST(request('POST', {}, { phase: 'released' }))

    expect(response.status).toBe(401)
    expect(getWhoPhase(getDb())).toBe('voting')
  })

  it('POST moves through voting, closed and released', async () => {
    for (const phase of ['closed', 'released', 'closed', 'voting'] as const) {
      const response = await POST(request('POST', adminHeaders(), { phase }))
      expect(response.status).toBe(200)
      expect((await response.json()).phase).toBe(phase)
      expect(getWhoPhase(getDb())).toBe(phase)
    }
  })

  it('POST rejects an unknown phase and the old boolean form', async () => {
    expect((await POST(request('POST', adminHeaders(), { phase: 'finished' }))).status).toBe(400)
    expect((await POST(request('POST', adminHeaders(), { released: true }))).status).toBe(400)
    expect(getWhoPhase(getDb())).toBe('voting')
  })
})
