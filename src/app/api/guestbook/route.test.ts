import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'
import { setFeatureLocked } from '@/lib/app-config'
import { getDb } from '@/lib/db'
import { GALLERY_COOKIE_NAME, createGallerySessionCookieValue } from '@/lib/gallery-auth'

// Gäste schreiben mit dem Kennwort vom Empfang (oder einer Sitzung daraus).
const PASSWORD = 'empfang-secret'

function postRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/guestbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ password: PASSWORD, ...body }),
  })
}

describe('/api/guestbook', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalPassword = process.env.GUEST_PASSWORD

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.GUEST_PASSWORD = PASSWORD
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    process.env.GUEST_PASSWORD = originalPassword
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

  it('POST rejects a wrong password without a cookie and stores nothing', async () => {
    const response = await POST(
      postRequest({ name: 'Anna', message: 'Wir freuen uns so sehr für euch beide!', password: 'falsch' })
    )
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()

    const body = await (await GET()).json()
    expect(body.entries).toHaveLength(0)
  })

  it('POST rejects a missing password', async () => {
    const response = await POST(
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Anna', message: 'Wir freuen uns so sehr für euch beide!' }),
      })
    )
    expect(response.status).toBe(401)
  })

  it('POST checks the password before the content, so a wrong password reveals nothing else', async () => {
    const response = await POST(postRequest({ name: '', message: 'x', password: 'falsch' }))
    expect(response.status).toBe(401)
  })

  it('POST with the correct password accepts case and spaces and sets a session cookie', async () => {
    const response = await POST(
      postRequest({ name: 'Anna', message: 'Wir freuen uns so sehr für euch beide!', password: ' EMPFANG-secret' })
    )
    expect(response.status).toBe(201)
    expect(response.headers.get('set-cookie')).toContain(`${GALLERY_COOKIE_NAME}=`)
  })

  it('POST with a valid session cookie needs no password in the body', async () => {
    const cookieValue = createGallerySessionCookieValue(getDb())
    const response = await POST(
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: `${GALLERY_COOKIE_NAME}=${cookieValue}` },
        body: JSON.stringify({ name: 'Anna', message: 'Wir freuen uns so sehr für euch beide!' }),
      })
    )
    expect(response.status).toBe(201)
    // Die Sitzung gilt schon: keine neue ausstellen.
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('POST with an expired session cookie and no password is rejected with 401', async () => {
    const stale = createGallerySessionCookieValue(getDb(), Date.now() - 31 * 24 * 60 * 60 * 1000)
    const response = await POST(
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: `${GALLERY_COOKIE_NAME}=${stale}` },
        body: JSON.stringify({ name: 'Anna', message: 'Wir freuen uns so sehr für euch beide!' }),
      })
    )
    expect(response.status).toBe(401)
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

  // Auf der Feier teilen sich viele Gäste eine Adresse: gezählt wird je Gerät.
  it('lets many devices behind one address write, each within its own allowance', async () => {
    const db = getDb()
    const base = Date.now()
    for (let device = 0; device < 40; device++) {
      const session = createGallerySessionCookieValue(db, base + device)
      for (let i = 0; i < 3; i++) {
        const response = await POST(
          postRequest(
            { name: 'Gast ' + device, message: 'Eine ganz gültige Nachricht hier drin.' },
            { cookie: `${GALLERY_COOKIE_NAME}=${session}`, 'x-forwarded-for': '203.0.113.50' }
          )
        )
        expect(response.status).toBe(201)
      }
    }
  })

  it('stops a single device after 20 entries in 15 minutes, not the others', async () => {
    const db = getDb()
    const base = Date.now()
    const noisy = createGallerySessionCookieValue(db, base + 1_000)
    const quiet = createGallerySessionCookieValue(db, base + 2_000)
    const write = (session: string) =>
      POST(
        postRequest(
          { name: 'Anna', message: 'Eine ganz gültige Nachricht hier drin.' },
          { cookie: `${GALLERY_COOKIE_NAME}=${session}`, 'x-forwarded-for': '203.0.113.51' }
        )
      )

    for (let i = 0; i < 20; i++) expect((await write(noisy)).status).toBe(201)
    expect((await write(noisy)).status).toBe(429)
    expect((await write(quiet)).status).toBe(201)
  })

  it('does not turn away the right password after many wrong ones from the same address', async () => {
    getDb()
    const send = (password: string) =>
      POST(
        postRequest(
          { name: 'Anna', message: 'Eine ganz gültige Nachricht hier drin.', password },
          { 'x-forwarded-for': '203.0.113.52' }
        )
      )

    let last = 0
    for (let i = 0; i < 25; i++) last = (await send('falsch')).status
    expect(last).toBe(429)

    expect((await send(PASSWORD)).status).toBe(201)
  })


  it('rejects a new entry with 423 while guestbook writes are locked, but GET still works', async () => {
    setFeatureLocked(getDb(), 'guestbook', true)

    const response = await POST(
      postRequest({ name: 'Anna', message: 'Eine Nachricht während der Sperre.' })
    )
    expect(response.status).toBe(423)

    const getResponse = await GET()
    expect(getResponse.status).toBe(200)
  })

  it('accepts a new entry again once guestbook writes are unlocked', async () => {
    setFeatureLocked(getDb(), 'guestbook', true)
    setFeatureLocked(getDb(), 'guestbook', false)

    const response = await POST(
      postRequest({ name: 'Anna', message: 'Eine Nachricht nach dem Entsperren.' })
    )
    expect(response.status).toBe(201)
  })

  it('locking memories or who_votes does not block guestbook', async () => {
    setFeatureLocked(getDb(), 'memories', true)
    setFeatureLocked(getDb(), 'who_votes', true)

    const response = await POST(
      postRequest({ name: 'Anna', message: 'Gästebuch bleibt offen.' })
    )
    expect(response.status).toBe(201)
  })
})
