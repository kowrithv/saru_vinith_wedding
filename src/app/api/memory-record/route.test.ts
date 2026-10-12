import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DELETE, GET, POST } from './route'
import { getDb } from '@/lib/db'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'

function request(method: string, options: { body?: unknown; cookie?: string; ip?: string } = {}): Request {
  const headers = new Headers()
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (options.cookie !== undefined) headers.set('cookie', `${ADMIN_COOKIE_NAME}=${options.cookie}`)
  if (options.ip !== undefined) headers.set('cf-connecting-ip', options.ip)
  return new Request('http://localhost/api/memory-record', {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

describe('/api/memory-record', () => {
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

  it('GET returns null while there is no record', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ record: null })
  })

  it('POST stores the first valid result as the record', async () => {
    const response = await POST(request('POST', { body: { moves: 14, seconds: 75 }, ip: '10.1.0.1' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ record: { moves: 14, seconds: 75 }, isNewRecord: true })
    expect(await (await GET()).json()).toEqual({ record: { moves: 14, seconds: 75 } })
  })

  it('POST keeps the record when the result is worse', async () => {
    await POST(request('POST', { body: { moves: 14, seconds: 75 }, ip: '10.1.0.2' }))

    const response = await POST(request('POST', { body: { moves: 20, seconds: 30 }, ip: '10.1.0.2' }))

    expect(await response.json()).toEqual({ record: { moves: 14, seconds: 75 }, isNewRecord: false })
  })

  it.each([
    ['too few moves for eight pairs', { moves: 7, seconds: 60 }],
    ['an impossibly short time', { moves: 14, seconds: 1 }],
    ['too many moves', { moves: 100000, seconds: 60 }],
    ['too long a time', { moves: 14, seconds: 6000 }],
    ['a fractional number', { moves: 14.5, seconds: 60 }],
    ['text instead of numbers', { moves: '14', seconds: '60' }],
    ['a missing field', { moves: 14 }],
    ['a negative number', { moves: -14, seconds: 60 }],
  ])('POST rejects %s without touching the record', async (_label, body) => {
    const response = await POST(request('POST', { body, ip: '10.1.0.3' }))

    expect(response.status).toBe(400)
    expect(await (await GET()).json()).toEqual({ record: null })
  })

  it('POST rejects a body that is not JSON', async () => {
    const bad = new Request('http://localhost/api/memory-record', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '10.1.0.4' },
      body: 'not json',
    })
    expect((await POST(bad)).status).toBe(400)
  })

  it('POST is rate limited per address', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 61; i++) {
      const response = await POST(request('POST', { body: { moves: 30, seconds: 100 }, ip: '10.1.0.5' }))
      statuses.push(response.status)
    }
    expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true)
    expect(statuses[60]).toBe(429)
  })

  it('DELETE rejects a request without an admin cookie and keeps the record', async () => {
    await POST(request('POST', { body: { moves: 14, seconds: 75 }, ip: '10.1.0.6' }))

    const response = await DELETE(request('DELETE'))

    expect(response.status).toBe(401)
    expect((await (await GET()).json()).record).toEqual({ moves: 14, seconds: 75 })
  })

  it('DELETE resets the record for an admin', async () => {
    await POST(request('POST', { body: { moves: 14, seconds: 75 }, ip: '10.1.0.7' }))
    const db = getDb()
    const cookie = signCookieValue(Date.now() + 60_000, getOrCreateAdminSecret(db))

    const response = await DELETE(request('DELETE', { cookie }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ record: null })
    expect(await (await GET()).json()).toEqual({ record: null })
  })
})
