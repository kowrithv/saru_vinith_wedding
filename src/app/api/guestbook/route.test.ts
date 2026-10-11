import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/guestbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/guestbook', () => {
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

  it('POST adds a valid entry and GET returns it', async () => {
    const postResponse = await POST(
      postRequest({ name: 'Anna', message: 'Wir freuen uns so sehr für euch beide!' })
    )
    expect(postResponse.status).toBe(201)

    const getResponse = await GET()
    const body = await getResponse.json()
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0].name).toBe('Anna')
  })

  it('POST rejects a message shorter than 10 characters', async () => {
    const response = await POST(postRequest({ name: 'Anna', message: 'Zu kurz' }))
    expect(response.status).toBe(400)

    const getResponse = await GET()
    const body = await getResponse.json()
    expect(body.entries).toHaveLength(0)
  })

  it('POST rejects a whitespace-only message', async () => {
    const response = await POST(postRequest({ name: 'Anna', message: '              ' }))
    expect(response.status).toBe(400)
  })

  it('POST rejects a missing name', async () => {
    const response = await POST(postRequest({ message: 'Eine ausreichend lange Nachricht.' }))
    expect(response.status).toBe(400)
  })

  it('blocks a sixth submission from the same IP within the window', async () => {
    const request = () =>
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
        body: JSON.stringify({ name: 'Anna', message: 'Eine gültige Nachricht hier drin.' }),
      })

    for (let i = 0; i < 5; i++) {
      const response = await POST(request())
      expect(response.status).toBe(201)
    }

    const sixth = await POST(request())
    expect(sixth.status).toBe(429)
  })
})
