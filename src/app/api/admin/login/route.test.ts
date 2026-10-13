import { beforeEach, describe, expect, it } from 'vitest'
import { POST } from './route'

function loginRequest(password: unknown, ip = '203.0.113.1') {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ password }),
  })
}

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'richtiges-passwort'
    process.env.DATABASE_PATH = ':memory:'
    delete globalThis.__appDb
  })

  it('returns 401 for an incorrect password', async () => {
    const response = await POST(loginRequest('falsch', '203.0.113.10'))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'Falsches Passwort.',
    })
  })

  it('returns 200 and sets a signed cookie for the correct password', async () => {
    const response = await POST(loginRequest('richtiges-passwort', '203.0.113.20'))
    expect(response.status).toBe(200)
    const cookie = response.headers.get('set-cookie')
    expect(cookie).toContain('admin_session=')
    expect(cookie).toContain('HttpOnly')
  })

  it('returns 400 for a malformed body', async () => {
    const response = await POST(loginRequest(undefined, '203.0.113.30'))
    expect(response.status).toBe(400)
  })

  it('returns 429 after exceeding the rate limit for one IP', async () => {
    const ip = '203.0.113.40'
    for (let i = 0; i < 5; i += 1) {
      await POST(loginRequest('falsch', ip))
    }
    const response = await POST(loginRequest('falsch', ip))
    expect(response.status).toBe(429)
  })

  it('does not count successful logins against the limit (several devices, smoke test, login/logout cycles)', async () => {
    const ip = '203.0.113.45'
    for (let i = 0; i < 4; i += 1) {
      await POST(loginRequest('falsch', ip))
    }
    const results: number[] = []
    for (let i = 0; i < 3; i += 1) {
      results.push((await POST(loginRequest('richtiges-passwort', ip))).status)
    }
    expect(results).toEqual([200, 200, 200])
  })

  it('returns 500 with a German message when ADMIN_PASSWORD is unset, without throwing', async () => {
    delete process.env.ADMIN_PASSWORD
    const response = await POST(loginRequest('irgendwas', '203.0.113.50'))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Admin-Login ist nicht konfiguriert.',
    })
  })
})
