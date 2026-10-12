import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'
import { setFeatureLocked } from '@/lib/app-config'
import { getDb } from '@/lib/db'

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/memories', () => {
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

  it('POST with the correct password adds a text-only entry', async () => {
    const response = await POST(
      postRequest({
        name: 'Anna',
        message: 'Ich erinnere mich an den Tag eures Kennenlernens.',
        password: 'empfang-secret',
      })
    )
    expect(response.status).toBe(201)

    const getResponse = await GET()
    const body = await getResponse.json()
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0].photoKey).toBeNull()
  })

  it('POST rejects a wrong password without revealing anything else', async () => {
    const response = await POST(
      postRequest({
        name: 'Anna',
        message: 'Ich erinnere mich an den Tag eures Kennenlernens.',
        password: 'falsches-kennwort',
      })
    )
    expect(response.status).toBe(401)

    const getResponse = await GET()
    const body = await getResponse.json()
    expect(body.entries).toHaveLength(0)
  })

  it('POST rejects a missing password', async () => {
    const response = await POST(
      postRequest({ name: 'Anna', message: 'Ich erinnere mich an den Tag eures Kennenlernens.' })
    )
    expect(response.status).toBe(401)
  })

  it('POST rejects a message shorter than 10 characters even with a correct password', async () => {
    const response = await POST(
      postRequest({ name: 'Anna', message: 'Kurz', password: 'empfang-secret' })
    )
    expect(response.status).toBe(400)
  })

  it('blocks the 31st submission from the same IP within the window', async () => {
    // Venue-WLAN/Mobilfunk-NAT kann viele Gäste hinter derselben IP
    // zusammenfassen - ein Limit von nur 5 würde die ganze Tischrunde
    // nach den ersten paar echten Einträgen aussperren (Review-Fund).
    const request = () =>
      new Request('http://localhost/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
        body: JSON.stringify({
          name: 'Anna',
          message: 'Eine gültige Erinnerung hier drin.',
          password: 'empfang-secret',
        }),
      })

    for (let i = 0; i < 30; i++) {
      const response = await POST(request())
      expect(response.status).toBe(201)
    }

    const overLimit = await POST(request())
    expect(overLimit.status).toBe(429)
  })

  it('rejects a new entry with 423 while memories writes are locked, but GET still works', async () => {
    setFeatureLocked(getDb(), 'memories', true)

    const response = await POST(
      postRequest({
        name: 'Anna',
        message: 'Eine Erinnerung während der Sperre.',
        password: 'empfang-secret',
      })
    )
    expect(response.status).toBe(423)

    const getResponse = await GET()
    expect(getResponse.status).toBe(200)
  })

  it('locking guestbook or who_votes does not block memories', async () => {
    setFeatureLocked(getDb(), 'guestbook', true)
    setFeatureLocked(getDb(), 'who_votes', true)

    const response = await POST(
      postRequest({
        name: 'Anna',
        message: 'Erinnerungen bleiben offen.',
        password: 'empfang-secret',
      })
    )
    expect(response.status).toBe(201)
  })
})
