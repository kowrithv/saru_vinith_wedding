import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DELETE } from './route'
import { getDb } from '@/lib/db'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'
import { getMemoryRecord, listMemoryResults, submitMemoryResult } from '@/lib/memory-record'

function request(cookie?: string): Request {
  const headers = new Headers()
  if (cookie !== undefined) headers.set('cookie', `${ADMIN_COOKIE_NAME}=${cookie}`)
  return new Request('http://localhost/api/admin/memory-results/1', { method: 'DELETE', headers })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe('DELETE /api/admin/memory-results/[id]', () => {
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

  function adminCookie() {
    return signCookieValue(Date.now() + 60_000, getOrCreateAdminSecret(getDb()))
  }

  it('rejects a request without an admin cookie and keeps the result', async () => {
    submitMemoryResult(getDb(), { moves: 8, seconds: 4 })
    const id = listMemoryResults(getDb()).results[0].id

    const response = await DELETE(request(), params(String(id)))

    expect(response.status).toBe(401)
    expect(getMemoryRecord(getDb())).toEqual({ moves: 8, seconds: 4 })
  })

  it('deletes one result and returns the record that remains', async () => {
    const db = getDb()
    submitMemoryResult(db, { moves: 8, seconds: 4 })
    submitMemoryResult(db, { moves: 14, seconds: 75 })
    const forged = listMemoryResults(db).results[0]

    const response = await DELETE(request(adminCookie()), params(String(forged.id)))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ record: { moves: 14, seconds: 75 }, total: 1 })
  })

  it('answers 404 for a result that does not exist', async () => {
    const response = await DELETE(request(adminCookie()), params('999'))
    expect(response.status).toBe(404)
  })

  it('answers 400 for an id that is not a whole number', async () => {
    const response = await DELETE(request(adminCookie()), params('abc'))
    expect(response.status).toBe(400)
  })
})
