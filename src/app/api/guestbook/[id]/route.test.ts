import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DELETE } from './route'
import { addGuestbookEntry } from '@/lib/guestbook'
import { getDb } from '@/lib/db'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue, adminCookieSecret } from '@/lib/admin-auth'

function deleteRequest(id: string, cookieValue?: string): Request {
  const headers = new Headers()
  if (cookieValue !== undefined) {
    headers.set('cookie', `${ADMIN_COOKIE_NAME}=${cookieValue}`)
  }
  return new Request(`http://localhost/api/guestbook/${id}`, { method: 'DELETE', headers })
}

describe('DELETE /api/guestbook/[id]', () => {
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

  it('deletes an entry when the request carries a valid admin cookie', async () => {
    const db = getDb()
    const entry = addGuestbookEntry(db, 'Anna', 'Eine Nachricht, die gelöscht werden soll.')
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, adminCookieSecret(secret))

    const response = await DELETE(deleteRequest(String(entry.id), cookieValue), {
      params: Promise.resolve({ id: String(entry.id) }),
    })
    expect(response.status).toBe(200)
  })

  it('rejects the request when there is no admin cookie', async () => {
    const db = getDb()
    const entry = addGuestbookEntry(db, 'Anna', 'Eine Nachricht, die bleiben soll.')

    const response = await DELETE(deleteRequest(String(entry.id)), {
      params: Promise.resolve({ id: String(entry.id) }),
    })
    expect(response.status).toBe(401)
  })

  it('returns 404 when deleting an id that does not exist, not a 500', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, adminCookieSecret(secret))

    const response = await DELETE(deleteRequest('999999', cookieValue), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(response.status).toBe(404)
  })
})
