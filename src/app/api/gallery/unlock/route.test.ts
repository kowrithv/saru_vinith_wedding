import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST } from './route'
import { getDb } from '@/lib/db'
import { GALLERY_COOKIE_NAME } from '@/lib/gallery-auth'

function unlockRequest(password?: string, clientIp?: string): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (clientIp !== undefined) {
    headers.set('x-forwarded-for', clientIp)
  }
  return new Request('http://localhost/api/gallery/unlock', {
    method: 'POST',
    headers,
    body: JSON.stringify({ password }),
  })
}

describe('POST /api/gallery/unlock', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalPassword = process.env.GUEST_PASSWORD

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.GUEST_PASSWORD = 'empfang-secret'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    process.env.GUEST_PASSWORD = originalPassword
  })

  it('sets a gallery session cookie on the correct password', async () => {
    getDb()
    const response = await POST(unlockRequest('empfang-secret'))
    expect(response.status).toBe(200)
    const cookie = response.headers.get('set-cookie')
    expect(cookie).toContain(`${GALLERY_COOKIE_NAME}=`)
    expect(cookie).toContain('HttpOnly')
  })

  it('accepts the password regardless of case and surrounding spaces', async () => {
    getDb()
    const response = await POST(unlockRequest('  EMPFANG-Secret '))
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain(`${GALLERY_COOKIE_NAME}=`)
  })

  // Das gedruckte Kennwort ist ein einfaches Wort, das Gäste am Handy tippen:
  // Auto-Großschreibung am Wortanfang und Leerzeichen dürfen nichts ausmachen.
  it.each(['love', 'Love', 'LOVE', ' love ', 'lOvE'])('accepts "%s" for the configured word "love"', async (typed) => {
    process.env.GUEST_PASSWORD = 'love'
    getDb()
    const response = await POST(unlockRequest(typed))
    expect(response.status).toBe(200)
  })

  it('accepts the lower case word when the server was configured with capitals', async () => {
    process.env.GUEST_PASSWORD = 'Love'
    getDb()
    const response = await POST(unlockRequest('love'))
    expect(response.status).toBe(200)
  })

  it('rejects the wrong password without setting a cookie', async () => {
    getDb()
    const response = await POST(unlockRequest('falsch'))
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  // Mit dem einfachen Wort auf dem Flyer sind Tippfehler und Neugier häufiger,
  // und viele Gäste teilen sich die IP des Veranstaltungs-WLANs: 20 Fehlversuche
  // je Adresse und 15 Minuten. Ein Skript bremst das auf 80 je Stunde.
  it('lets 20 wrong attempts through as "wrong password" and rejects the 21st', async () => {
    getDb()
    const statuses: number[] = []
    for (let i = 0; i < 21; i++) {
      const response = await POST(unlockRequest('falsch', '10.0.0.20'))
      statuses.push(response.status)
    }
    expect(statuses.slice(0, 20).every((status) => status === 401)).toBe(true)
    expect(statuses[20]).toBe(429)
  })

  it('limits per address: another address is not affected by a locked one', async () => {
    getDb()
    for (let i = 0; i < 21; i++) {
      await POST(unlockRequest('falsch', '10.0.0.21'))
    }
    const locked = await POST(unlockRequest('empfang-secret', '10.0.0.21'))
    const other = await POST(unlockRequest('empfang-secret', '10.0.0.22'))
    expect(locked.status).toBe(429)
    expect(other.status).toBe(200)
  })

  it('tells the guest how long to wait', async () => {
    getDb()
    for (let i = 0; i < 21; i++) {
      await POST(unlockRequest('falsch', '10.0.0.23'))
    }
    const response = await POST(unlockRequest('falsch', '10.0.0.23'))
    expect(response.status).toBe(429)
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await response.json()).error).toMatch(/minute/i)
  })

  // Viele Gäste teilen sich die IP des Veranstaltungs-WLANs: erfolgreiche
  // Entsperrungen dürfen das Kontingent nicht aufbrauchen.
  it('does not count successful unlocks against the rate limit', async () => {
    getDb()
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      const response = await POST(unlockRequest('empfang-secret', '10.0.0.9'))
      statuses.push(response.status)
    }
    expect(statuses.every((status) => status === 200)).toBe(true)
  })
})
