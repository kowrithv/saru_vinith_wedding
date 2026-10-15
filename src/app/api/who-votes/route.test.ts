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
    delete globalThis.__resultsCodeFailures
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

  it('shows the live counts for the word in upper case', async () => {
    const typed = resultsKey(getDb()).toUpperCase()

    const body = await (await GET(getRequest({ [RESULTS_KEY_HEADER]: typed }))).json()

    expect(Object.keys(body.questions)).toHaveLength(whoQuestions.length)
  })

  it('keeps hiding the results from a wrong word', async () => {
    const body = await (await GET(getRequest({ [RESULTS_KEY_HEADER]: 'zzzzzz' }))).json()
    expect(body.questions).toBeNull()
  })

  it('answers 429 after too many wrong words, but still serves the right one', async () => {
    const wrong = () => GET(getRequest({ [RESULTS_KEY_HEADER]: 'zzzzzz', 'x-forwarded-for': '10.1.1.1' }))
    let last: Response | null = null
    for (let index = 0; index < 40; index += 1) {
      last = await wrong()
      if (last.status === 429) break
    }
    expect(last?.status).toBe(429)
    expect(Number(last?.headers.get('retry-after'))).toBeGreaterThan(0)

    const right = await GET(
      getRequest({ [RESULTS_KEY_HEADER]: resultsKey(getDb()), 'x-forwarded-for': '10.1.1.1' })
    )
    expect(right.status).toBe(200)
    expect((await right.json()).questions).not.toBeNull()
  })

  it('never blocks guests who only ask for the released state', async () => {
    for (let index = 0; index < 60; index += 1) {
      const response = await GET(getRequest({ 'x-forwarded-for': '10.1.1.2' }))
      expect(response.status).toBe(200)
    }
  })

  it('shows the results to everyone after the release, even to a blocked address', async () => {
    for (let index = 0; index < 40; index += 1) {
      await GET(getRequest({ [RESULTS_KEY_HEADER]: 'zzzzzz', 'x-forwarded-for': '10.1.1.3' }))
    }
    setResultsReleased(getDb(), true)

    const response = await GET(getRequest({ [RESULTS_KEY_HEADER]: 'zzzzzz', 'x-forwarded-for': '10.1.1.3' }))

    expect(response.status).toBe(200)
    expect((await response.json()).released).toBe(true)
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
