import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST } from './route'
import { whoGameOptions } from '@/lib/who-game-content'
import { setFeatureLocked } from '@/lib/app-config'
import { getDb } from '@/lib/db'
import { getTally } from '@/lib/who-votes'
import { setResultsReleased, setWhoPhase } from '@/lib/who-results'
import { GALLERY_COOKIE_NAME, createGallerySessionCookieValue } from '@/lib/gallery-auth'

// Abgestimmt wird mit dem Gäste-Kennwort (oder einer Sitzung daraus).
const PASSWORD = 'love'

function postRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/who-votes/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ password: PASSWORD, ...body }),
  })
}

function vote(questionId: string, voterId: string, option: string, extra: Record<string, unknown> = {}) {
  return postRequest({ questionId, voterId, option, ...extra })
}

describe('POST /api/who-votes/vote', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalPassword = process.env.GUEST_PASSWORD
  const originalSecret = process.env.ADMIN_SECRET

  beforeEach(() => {
    delete globalThis.__appDb
    delete globalThis.__guestPasswordFailures
    process.env.DATABASE_PATH = ':memory:'
    process.env.GUEST_PASSWORD = PASSWORD
    process.env.ADMIN_SECRET = 'test-admin-secret'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    if (originalPassword === undefined) delete process.env.GUEST_PASSWORD
    else process.env.GUEST_PASSWORD = originalPassword
    if (originalSecret === undefined) delete process.env.ADMIN_SECRET
    else process.env.ADMIN_SECRET = originalSecret
  })

  it('records a valid vote without revealing the tally', async () => {
    const response = await POST(vote('1', 'voter-a', whoGameOptions[0]))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ alreadyVoted: false, changed: false })
    expect(getTally(getDb())['1'][whoGameOptions[0]]).toBe(1)
  })

  it('lets a device change its vote on a question and counts it once', async () => {
    await POST(vote('1', 'voter-a', whoGameOptions[0]))
    const response = await POST(vote('1', 'voter-a', whoGameOptions[1]))

    expect(await response.json()).toEqual({ alreadyVoted: true, changed: true })
    const tally = getTally(getDb())['1']
    expect(tally[whoGameOptions[0]]).toBe(0)
    expect(tally[whoGameOptions[1]]).toBe(1)
  })

  it('reports the same answer sent again as unchanged', async () => {
    await POST(vote('1', 'voter-a', whoGameOptions[0]))
    const response = await POST(vote('1', 'voter-a', whoGameOptions[0]))

    expect(await response.json()).toEqual({ alreadyVoted: true, changed: false })
    expect(getTally(getDb())['1'][whoGameOptions[0]]).toBe(1)
  })

  it('does not let a vote change once the results are released', async () => {
    await POST(vote('1', 'voter-a', whoGameOptions[0]))
    setResultsReleased(getDb(), true)

    const response = await POST(vote('1', 'voter-a', whoGameOptions[1]))

    expect(response.status).toBe(423)
    const tally = getTally(getDb())['1']
    expect(tally[whoGameOptions[0]]).toBe(1)
    expect(tally[whoGameOptions[1]]).toBe(0)
  })

  it('does not let a vote change while voting is locked', async () => {
    await POST(vote('1', 'voter-a', whoGameOptions[0]))
    setFeatureLocked(getDb(), 'who_votes', true)

    const response = await POST(vote('1', 'voter-a', whoGameOptions[1]))

    expect(response.status).toBe(423)
    expect(getTally(getDb())['1'][whoGameOptions[0]]).toBe(1)
  })

  it('rejects an unknown question id with 400', async () => {
    const response = await POST(vote('does-not-exist', 'voter-a', whoGameOptions[0]))
    expect(response.status).toBe(400)
  })

  it('rejects a malformed body with 400', async () => {
    const response = await POST(postRequest({ questionId: '1' }))
    expect(response.status).toBe(400)
  })

  it('rejects a vote with 423 once the voting is closed', async () => {
    setWhoPhase(getDb(), 'closed')

    const response = await POST(vote('1', 'voter-a', whoGameOptions[0]))

    expect(response.status).toBe(423)
    expect((await response.json()).error).toBe('Die Abstimmung ist beendet.')
    expect(getTally(getDb())['1'][whoGameOptions[0]]).toBe(0)
  })

  it('takes votes again when the admin moves the voting back to open', async () => {
    setWhoPhase(getDb(), 'closed')
    setWhoPhase(getDb(), 'voting')

    const response = await POST(vote('1', 'voter-a', whoGameOptions[0]))

    expect(response.status).toBe(200)
  })

  it('rejects a vote with 423 once the results are released', async () => {
    setResultsReleased(getDb(), true)

    const response = await POST(vote('1', 'voter-a', whoGameOptions[0]))

    expect(response.status).toBe(423)
    expect(getTally(getDb())['1'][whoGameOptions[0]]).toBe(0)
  })

  it('locking guestbook or memories does not block voting', async () => {
    setFeatureLocked(getDb(), 'guestbook', true)
    setFeatureLocked(getDb(), 'memories', true)

    const response = await POST(vote('1', 'voter-a', whoGameOptions[0]))
    expect(response.status).toBe(200)
  })

  describe('guest password', () => {
    it('rejects a wrong password with 401, no cookie and no vote', async () => {
      const response = await POST(vote('1', 'voter-a', whoGameOptions[0], { password: 'falsch' }))

      expect(response.status).toBe(401)
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(getTally(getDb())['1'][whoGameOptions[0]]).toBe(0)
    })

    it('rejects a request without any password with 401', async () => {
      const response = await POST(
        new Request('http://localhost/api/who-votes/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[0] }),
        })
      )
      expect(response.status).toBe(401)
      expect(getTally(getDb())['1'][whoGameOptions[0]]).toBe(0)
    })

    it('accepts the password in any letter case', async () => {
      const response = await POST(vote('1', 'voter-a', whoGameOptions[0], { password: 'LOVE' }))
      expect(response.status).toBe(200)
    })

    it('sets the guest session with the right password', async () => {
      const response = await POST(vote('1', 'voter-a', whoGameOptions[0]))
      expect(response.headers.get('set-cookie')).toContain(`${GALLERY_COOKIE_NAME}=`)
    })

    it('accepts a valid session without a password', async () => {
      const cookie = createGallerySessionCookieValue(getDb())
      const response = await POST(
        new Request('http://localhost/api/who-votes/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: `${GALLERY_COOKIE_NAME}=${cookie}` },
          body: JSON.stringify({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[0] }),
        })
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('set-cookie')).toBeNull()
    })
  })

  describe('limit per device', () => {
    function sessionVote(cookie: string, index: number): Request {
      return new Request('http://localhost/api/who-votes/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: `${GALLERY_COOKIE_NAME}=${cookie}` },
        body: JSON.stringify({ questionId: '1', voterId: `flood-${index}`, option: whoGameOptions[0] }),
      })
    }

    it('stops a single device that floods votes with made-up voter ids', async () => {
      const cookie = createGallerySessionCookieValue(getDb())
      let tooMany = 0
      for (let index = 0; index < 80; index += 1) {
        const response = await POST(sessionVote(cookie, index))
        if (response.status === 429) tooMany += 1
      }
      expect(tooMany).toBeGreaterThan(0)
      expect(getTally(getDb())['1'][whoGameOptions[0]]).toBeLessThanOrEqual(60)
    })
  })
})
