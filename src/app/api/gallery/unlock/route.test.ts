import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST } from './route'
import { getDb } from '@/lib/db'
import { GALLERY_COOKIE_NAME } from '@/lib/gallery-auth'

function unlockRequest(password?: string): Request {
  return new Request('http://localhost/api/gallery/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

describe('POST /api/gallery/unlock', () => {
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

  it('sets a gallery session cookie on the correct password', async () => {
    getDb()
    const response = await POST(unlockRequest('empfang-secret'))
    expect(response.status).toBe(200)
    const cookie = response.headers.get('set-cookie')
    expect(cookie).toContain(`${GALLERY_COOKIE_NAME}=`)
    expect(cookie).toContain('HttpOnly')
  })

  it('rejects the wrong password without setting a cookie', async () => {
    getDb()
    const response = await POST(unlockRequest('falsch'))
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects the 6th attempt within 15 minutes', async () => {
    getDb()
    for (let i = 0; i < 5; i++) {
      await POST(unlockRequest('falsch'))
    }
    const response = await POST(unlockRequest('falsch'))
    expect(response.status).toBe(429)
  })
})
