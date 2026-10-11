import { describe, expect, it } from 'vitest'
import { GET } from './route'

describe('GET /api/health', () => {
  it('returns ok:true with status 200', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('answers even when the database path is invalid, proving it never touches the DB', async () => {
    const original = process.env.DATABASE_PATH
    process.env.DATABASE_PATH = '/does/not/exist/wedding.db'
    try {
      const response = await GET()
      expect(response.status).toBe(200)
    } finally {
      process.env.DATABASE_PATH = original
    }
  })
})
