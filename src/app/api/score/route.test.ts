import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'
import { getDb } from '@/lib/db'
import { SCORE_COOKIE_NAME, createScoreSessionCookieValue } from '@/lib/score-auth'
import { ADMIN_COOKIE_NAME, adminCookieSecret, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'
import { getScore } from '@/lib/score'
import { subscribeScore } from '@/lib/score-hub'

function scoreRequest(method: string, cookie?: string, body?: unknown): Request {
  const headers = new Headers()
  if (cookie !== undefined) headers.set('cookie', cookie)
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  return new Request('http://localhost/api/score', {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('/api/score', () => {
  const original = { score: process.env.SCORE_PASSWORD, db: process.env.DATABASE_PATH }
  let cookie: string

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.SCORE_PASSWORD = 'Torte'
    cookie = `${SCORE_COOKIE_NAME}=${createScoreSessionCookieValue(getDb())}`
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    delete globalThis.__scoreHub
    process.env.DATABASE_PATH = original.db
    if (original.score === undefined) delete process.env.SCORE_PASSWORD
    else process.env.SCORE_PASSWORD = original.score
  })

  it('GET rejects a request without a score session', async () => {
    expect((await GET(scoreRequest('GET'))).status).toBe(401)
  })

  it('GET rejects an admin session: the admin is no score operator', async () => {
    const admin = signCookieValue(Date.now() + 60_000, adminCookieSecret(getOrCreateAdminSecret(getDb())))
    expect((await GET(scoreRequest('GET', `${ADMIN_COOKIE_NAME}=${admin}`))).status).toBe(401)
  })

  it('GET returns the current score uncached', async () => {
    const response = await GET(scoreRequest('GET', cookie))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ bride: 0, groom: 0, rev: 0 })
  })

  it('POST rejects a request without a score session and changes nothing', async () => {
    const response = await POST(scoreRequest('POST', undefined, { action: 'change', team: 'bride', delta: 1 }))
    expect(response.status).toBe(401)
    expect(getScore(getDb()).bride).toBe(0)
  })

  it('POST changes one team, answers with the new score and pushes it to open streams', async () => {
    const listener = vi.fn()
    subscribeScore(listener)

    const response = await POST(scoreRequest('POST', cookie, { action: 'change', team: 'bride', delta: 1 }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ bride: 1, groom: 0, rev: 1 })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ bride: 1, groom: 0, rev: 1 })
  })

  it('POST counts down but never below 0', async () => {
    await POST(scoreRequest('POST', cookie, { action: 'change', team: 'groom', delta: 1 }))
    await POST(scoreRequest('POST', cookie, { action: 'change', team: 'groom', delta: -1 }))
    const response = await POST(scoreRequest('POST', cookie, { action: 'change', team: 'groom', delta: -1 }))
    expect((await response.json()).groom).toBe(0)
  })

  it('POST reset sets both to 0 and pushes it', async () => {
    await POST(scoreRequest('POST', cookie, { action: 'change', team: 'bride', delta: 1 }))
    await POST(scoreRequest('POST', cookie, { action: 'change', team: 'groom', delta: 1 }))
    const listener = vi.fn()
    subscribeScore(listener)

    const response = await POST(scoreRequest('POST', cookie, { action: 'reset' }))
    expect(await response.json()).toEqual({ bride: 0, groom: 0, rev: 3 })
    expect(listener).toHaveBeenCalledWith({ bride: 0, groom: 0, rev: 3 })
  })

  it.each([
    ['unknown team', { action: 'change', team: 'bridesmaids', delta: 1 }],
    ['delta of 0', { action: 'change', team: 'bride', delta: 0 }],
    ['delta of 2', { action: 'change', team: 'bride', delta: 2 }],
    ['fractional delta', { action: 'change', team: 'bride', delta: 0.5 }],
    ['unknown action', { action: 'set', team: 'bride', score: 99 }],
    ['empty object', {}],
    ['broken json', 'kein json'],
  ])('POST rejects %s', async (_name, body) => {
    const response = await POST(scoreRequest('POST', cookie, body))
    expect(response.status).toBe(400)
    expect(getScore(getDb())).toEqual({ bride: 0, groom: 0, rev: 0 })
  })
})
