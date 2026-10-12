import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { getDb } from '@/lib/db'

vi.mock('@/lib/r2', () => ({
  createPresignedPutUrl: vi.fn(async (key: string) => `https://r2.example/${key}?signed`),
}))

function requestBody(body: unknown): Request {
  return new Request('http://localhost/api/uploads/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      requestBody({ password: 'falsch', files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }] })
    )
    expect(response.status).toBe(401)
  })

  it('issues one ticket per file with the correct password', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
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
  })

  it('rejects an unknown content type before issuing any ticket', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        files: [{ filename: 'a.mov', size: 1000, contentType: 'video/quicktime' }],
      })
    )
    expect(response.status).toBe(400)
  })

  it('rejects a file declared larger than the size cap', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        files: [{ filename: 'a.jpg', size: 21 * 1024 * 1024, contentType: 'image/jpeg' }],
      })
    )
    expect(response.status).toBe(400)
  })
})
