import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST } from './route'
import { whoGameOptions } from '@/lib/who-game-content'
import { setFeatureLocked } from '@/lib/app-config'
import { getDb } from '@/lib/db'

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/who-votes/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/who-votes/vote', () => {
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

  it('records a valid vote and returns the updated tally', async () => {
    const response = await POST(
      postRequest({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[0] })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.tally[whoGameOptions[0]]).toBe(1)
    expect(body.alreadyVoted).toBe(false)
  })

  it('does not count a second vote from the same device on the same question', async () => {
    await POST(postRequest({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[0] }))
    const response = await POST(
      postRequest({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[1] })
    )
    const body = await response.json()
    expect(body.alreadyVoted).toBe(true)
    expect(body.tally[whoGameOptions[0]]).toBe(1)
    expect(body.tally[whoGameOptions[1]]).toBe(0)
  })

  it('rejects an unknown question id with 400', async () => {
    const response = await POST(
      postRequest({ questionId: 'does-not-exist', voterId: 'voter-a', option: whoGameOptions[0] })
    )
    expect(response.status).toBe(400)
  })

  it('rejects a malformed body with 400', async () => {
    const response = await POST(postRequest({ questionId: '1' }))
    expect(response.status).toBe(400)
  })

  it('rejects a vote with 423 while who_votes is locked', async () => {
    setFeatureLocked(getDb(), 'who_votes', true)

    const response = await POST(
      postRequest({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[0] })
    )
    expect(response.status).toBe(423)
  })

  it('locking guestbook or memories does not block voting', async () => {
    setFeatureLocked(getDb(), 'guestbook', true)
    setFeatureLocked(getDb(), 'memories', true)

    const response = await POST(
      postRequest({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[0] })
    )
    expect(response.status).toBe(200)
  })
})
