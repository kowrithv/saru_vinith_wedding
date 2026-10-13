import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from './route'
import { getDb } from '@/lib/db'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'
import { submitMemoryResult } from '@/lib/memory-record'

function request(cookie?: string): Request {
  const headers = new Headers()
  if (cookie !== undefined) headers.set('cookie', `${ADMIN_COOKIE_NAME}=${cookie}`)
  return new Request('http://localhost/api/admin/memory-results', { headers })
}

describe('GET /api/admin/memory-results', () => {
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

  it('rejects a request without an admin cookie', async () => {
    submitMemoryResult(getDb(), { moves: 14, seconds: 75 })
    const response = await GET(request())
    expect(response.status).toBe(401)
    expect(await response.text()).not.toContain('14')
  })

  it('lists the submitted results ranked, with a total, for an admin', async () => {
    const db = getDb()
    submitMemoryResult(db, { moves: 14, seconds: 75 })
    submitMemoryResult(db, { moves: 9, seconds: 30 })
    const cookie = signCookieValue(Date.now() + 60_000, getOrCreateAdminSecret(db))

    const response = await GET(request(cookie))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.total).toBe(2)
    expect(body.results.map((r: { moves: number; seconds: number }) => [r.moves, r.seconds])).toEqual([
      [9, 30],
      [14, 75],
    ])
    expect(body.results[0]).toEqual(expect.objectContaining({ id: expect.any(Number), createdAt: expect.any(String) }))
  })
})
