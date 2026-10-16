import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST } from './route'
import { SCORE_COOKIE_NAME, hasScoreAccess } from '@/lib/score-auth'
import { getDb } from '@/lib/db'

let ipCounter = 0

function loginRequest(body: unknown, ip: string): Request {
  return new Request('http://localhost/api/score/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/score/login', () => {
  const original = { score: process.env.SCORE_PASSWORD, admin: process.env.ADMIN_PASSWORD, db: process.env.DATABASE_PATH }
  let ip: string

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.SCORE_PASSWORD = 'Torte'
    process.env.ADMIN_PASSWORD = 'admin-pw'
    // Der Zähler für Fehlversuche lebt im Modul: jeder Test bekommt eine eigene Adresse.
    ip = `203.0.113.${++ipCounter}`
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = original.db
    if (original.score === undefined) delete process.env.SCORE_PASSWORD
    else process.env.SCORE_PASSWORD = original.score
    process.env.ADMIN_PASSWORD = original.admin
  })

  it('answers 503 when no score password is configured', async () => {
    delete process.env.SCORE_PASSWORD
    const response = await POST(loginRequest({ password: 'Torte' }, ip))
    expect(response.status).toBe(503)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects a wrong password without a cookie', async () => {
    const response = await POST(loginRequest({ password: 'Kuchen' }, ip))
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('does not accept the admin password', async () => {
    const response = await POST(loginRequest({ password: 'admin-pw' }, ip))
    expect(response.status).toBe(401)
  })

  it('rejects a missing or malformed body', async () => {
    expect((await POST(loginRequest('kein json', ip))).status).toBe(400)
    expect((await POST(loginRequest({}, ip))).status).toBe(400)
    expect((await POST(loginRequest({ password: '' }, ip))).status).toBe(400)
  })

  it('sets a working session cookie for the right password, ignoring case', async () => {
    const response = await POST(loginRequest({ password: ' torte ' }, ip))
    expect(response.status).toBe(200)
    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${SCORE_COOKIE_NAME}=`)
    expect(setCookie.toLowerCase()).toContain('httponly')

    const value = /score_session=([^;]+)/.exec(setCookie)?.[1] ?? ''
    const next = new Request('http://localhost/api/score', { headers: { cookie: `${SCORE_COOKIE_NAME}=${value}` } })
    expect(hasScoreAccess(next, getDb())).toBe(true)
  })

  it('blocks a sixth wrong attempt from the same address, but never the right password before that', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await POST(loginRequest({ password: `falsch${attempt}` }, ip))).status).toBe(401)
    }
    expect((await POST(loginRequest({ password: 'noch falsch' }, ip))).status).toBe(429)
  })

  it('forgives earlier wrong attempts after a correct login', async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      await POST(loginRequest({ password: `falsch${attempt}` }, ip))
    }
    expect((await POST(loginRequest({ password: 'Torte' }, ip))).status).toBe(200)
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await POST(loginRequest({ password: `falsch${attempt}` }, ip))).status).toBe(401)
    }
  })
})
