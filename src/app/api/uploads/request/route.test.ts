import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { getDb } from '@/lib/db'
import { setFeatureLocked } from '@/lib/app-config'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'
import { verifyUploadTicket } from '@/lib/upload-ticket'

vi.mock('@/lib/r2', () => ({
  createPresignedPutUrl: vi.fn(async (key: string) => `https://r2.example/${key}?signed`),
}))

function requestBody(body: unknown, cookieValue?: string, clientIp?: string): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (cookieValue !== undefined) {
    headers.set('cookie', `${ADMIN_COOKIE_NAME}=${cookieValue}`)
  }
  if (clientIp !== undefined) {
    headers.set('cf-connecting-ip', clientIp)
  }
  return new Request('http://localhost/api/uploads/request', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/uploads/request', () => {
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

  it('rejects the wrong password without issuing any ticket', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'falsch',
        category: 'Hochzeit',
        files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }],
      })
    )
    expect(response.status).toBe(401)
  })

  it('rejects a guest request with no password field at all', async () => {
    getDb()
    const response = await POST(
      requestBody({
        category: 'Hochzeit',
        files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }],
      })
    )
    expect(response.status).toBe(401)
  })

  it('issues tickets marked not official for a guest with the correct password', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Hochzeit',
        files: [
          { filename: 'a.jpg', size: 1_000_000, contentType: 'image/jpeg' },
          { filename: 'b.png', size: 2_000_000, contentType: 'image/png' },
        ],
      })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.tickets).toHaveLength(2)
    expect(body.tickets[0]).toMatchObject({
      thumbKey: expect.stringContaining('/thumb.jpg'),
      originalKey: expect.stringContaining('/original.jpg'),
    })
    expect(body.tickets[1].originalKey).toContain('/original.png')

    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const payload = verifyUploadTicket(body.tickets[0].ticket, secret)
    expect(payload?.isOfficial).toBe(false)
    expect(payload?.category).toBe('Hochzeit')
  })

  it('issues an official ticket without any password when the request has a valid admin cookie', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await POST(
      requestBody(
        { category: 'Verlobung', files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }] },
        cookieValue
      )
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    const payload = verifyUploadTicket(body.tickets[0].ticket, secret)
    expect(payload?.isOfficial).toBe(true)
    expect(payload?.category).toBe('Verlobung')
  })

  it('ignores a client-supplied isOfficial field for a guest request', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Hochzeit',
        isOfficial: true,
        files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }],
      })
    )
    const body = await response.json()
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const payload = verifyUploadTicket(body.tickets[0].ticket, secret)
    expect(payload?.isOfficial).toBe(false)
  })

  it('rejects an unknown category value', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Geburtstag',
        files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }],
      })
    )
    expect(response.status).toBe(400)
  })

  it('rejects an unknown content type before issuing any ticket', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Hochzeit',
        files: [{ filename: 'a.mov', size: 1000, contentType: 'video/quicktime' }],
      })
    )
    expect(response.status).toBe(400)
  })

  it('rejects a content type that collides with an Object prototype property', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Hochzeit',
        files: [{ filename: 'a.jpg', size: 1000, contentType: 'constructor' }],
      })
    )
    expect(response.status).toBe(400)
  })

  it('rejects a file declared larger than the size cap', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Hochzeit',
        files: [{ filename: 'a.jpg', size: 21 * 1024 * 1024, contentType: 'image/jpeg' }],
      })
    )
    expect(response.status).toBe(400)
  })

  // Auf einer gemeinsamen Veranstaltungs-WLAN-IP laden viele Gäste hoch:
  // erfolgreiche Anfragen dürfen das Kontingent nicht aufbrauchen, sonst
  // sperrt der Rate-Limiter nach einer Handvoll Gäste alle anderen aus.
  it('does not count successful requests against the rate limit', async () => {
    getDb()
    const statuses: number[] = []
    for (let i = 0; i < 40; i++) {
      const response = await POST(
        requestBody(
          {
            password: 'empfang-secret',
            category: 'Hochzeit',
            files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }],
          },
          undefined,
          '10.0.0.1'
        )
      )
      statuses.push(response.status)
    }
    expect(statuses.every((status) => status === 200)).toBe(true)
  })

  it('still locks out an address after 30 consecutive wrong passwords', async () => {
    getDb()
    const wrong = () =>
      POST(
        requestBody(
          {
            password: 'falsch',
            category: 'Hochzeit',
            files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }],
          },
          undefined,
          '10.0.0.2'
        )
      )

    for (let i = 0; i < 30; i++) {
      expect((await wrong()).status).toBe(401)
    }
    expect((await wrong()).status).toBe(429)
  })

  it('signs a ticket per file with its own photo id', async () => {
    getDb()
    const response = await POST(
      requestBody(
        {
          password: 'empfang-secret',
          category: 'Hochzeit',
          files: [
            { filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' },
            { filename: 'b.heic', size: 2000, contentType: 'image/heic' },
          ],
        },
        undefined,
        '10.0.0.3'
      )
    )
    const body = (await response.json()) as { tickets: { photoId: string; originalKey: string }[] }
    expect(body.tickets).toHaveLength(2)
    expect(body.tickets[0].photoId).not.toBe(body.tickets[1].photoId)
    expect(body.tickets[1].originalKey).toMatch(/original\.heic$/)
  })

  it('refuses a guest upload with 423 while uploads are locked, before the password is even checked', async () => {
    const db = getDb()
    setFeatureLocked(db, 'gallery_upload', true)
    const response = await POST(
      requestBody(
        { password: 'falsch', category: 'Hochzeit', files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }] },
        undefined,
        '10.0.1.1'
      )
    )
    expect(response.status).toBe(423)
    expect((await response.json()).error).toMatch(/pausiert/i)
  })

  it('still issues tickets to the admin while uploads are locked', async () => {
    const db = getDb()
    setFeatureLocked(db, 'gallery_upload', true)
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 60_000, secret)
    const response = await POST(
      requestBody(
        { category: 'Hochzeit', files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }] },
        cookieValue,
        '10.0.1.2'
      )
    )
    expect(response.status).toBe(200)
  })
})
