import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from './route'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'
import { getDb } from '@/lib/db'
import { setFeatureLocked } from '@/lib/app-config'
import { castVote } from '@/lib/who-votes'
import { RESULTS_KEY_HEADER, resultsKey, setResultsReleased } from '@/lib/who-results'
import { ADMIN_COOKIE_NAME, adminCookieSecret, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'

function getRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/who-votes', { headers })
}

describe('GET /api/who-votes', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalSecret = process.env.ADMIN_SECRET

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.ADMIN_SECRET = 'test-admin-secret'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    if (originalSecret === undefined) delete process.env.ADMIN_SECRET
    else process.env.ADMIN_SECRET = originalSecret
  })

  it('hides the results from guests until they are released', async () => {
    castVote(getDb(), '1', 'voter-a', whoGameOptions[0])

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toMatch(/no-store/)
    const body = await response.json()
    expect(body).toEqual({ released: false, questions: null })
  })

  it('returns a zero-initialized tally for every question once released', async () => {
    setResultsReleased(getDb(), true)

    const body = await (await GET(getRequest())).json()

    expect(body.released).toBe(true)
    expect(Object.keys(body.questions)).toHaveLength(whoQuestions.length)
    expect(body.questions['1'][whoGameOptions[0]]).toBe(0)
  })

  it('shows the counts once released', async () => {
    castVote(getDb(), '1', 'voter-a', whoGameOptions[0])
    castVote(getDb(), '1', 'voter-b', whoGameOptions[0])
    setResultsReleased(getDb(), true)

    const body = await (await GET(getRequest())).json()

    expect(body.questions['1'][whoGameOptions[0]]).toBe(2)
  })

  it('shows the live counts to the DJ link before the release', async () => {
    castVote(getDb(), '1', 'voter-a', whoGameOptions[1])

    const body = await (await GET(getRequest({ [RESULTS_KEY_HEADER]: resultsKey(getDb()) }))).json()

    expect(body.released).toBe(false)
    expect(body.questions['1'][whoGameOptions[1]]).toBe(1)
  })

  it('keeps hiding the results from a wrong key', async () => {
    const body = await (await GET(getRequest({ [RESULTS_KEY_HEADER]: 'a'.repeat(64) }))).json()
    expect(body.questions).toBeNull()
  })

  it('shows the live counts to an admin session', async () => {
    const db = getDb()
    const cookie = signCookieValue(Date.now() + 60_000, adminCookieSecret(getOrCreateAdminSecret(db)))

    const body = await (await GET(getRequest({ cookie: `${ADMIN_COOKIE_NAME}=${cookie}` }))).json()

    expect(Object.keys(body.questions)).toHaveLength(whoQuestions.length)
  })

  it('keeps the results readable while voting is locked', async () => {
    setFeatureLocked(getDb(), 'who_votes', true)
    setResultsReleased(getDb(), true)

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    expect(Object.keys((await response.json()).questions)).toHaveLength(whoQuestions.length)
  })
})
