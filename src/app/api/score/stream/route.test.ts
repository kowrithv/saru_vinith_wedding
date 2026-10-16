import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { getDb } from '@/lib/db'
import { SCORE_COOKIE_NAME, createScoreSessionCookieValue } from '@/lib/score-auth'
import { changeScore } from '@/lib/score'
import { publishScore, scoreSubscriberCount, subscribeScore } from '@/lib/score-hub'

function streamRequest(cookie?: string, signal?: AbortSignal): Request {
  const headers = new Headers()
  if (cookie !== undefined) headers.set('cookie', cookie)
  return new Request('http://localhost/api/score/stream', { headers, signal })
}

async function readText(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value } = await reader.read()
  return new TextDecoder().decode(value)
}

describe('GET /api/score/stream', () => {
  const original = { score: process.env.SCORE_PASSWORD, db: process.env.DATABASE_PATH }
  let cookie: string

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.SCORE_PASSWORD = 'Torte'
    cookie = `${SCORE_COOKIE_NAME}=${createScoreSessionCookieValue(getDb())}`
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    delete globalThis.__scoreHub
    process.env.DATABASE_PATH = original.db
    if (original.score === undefined) delete process.env.SCORE_PASSWORD
    else process.env.SCORE_PASSWORD = original.score
  })

  it('rejects a request without a score session', async () => {
    const response = await GET(streamRequest())
    expect(response.status).toBe(401)
    expect(scoreSubscriberCount()).toBe(0)
  })

  it('opens an event stream that is not cached or compressed in between', async () => {
    const controller = new AbortController()
    const response = await GET(streamRequest(cookie, controller.signal))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(response.headers.get('cache-control')).toContain('no-cache')
    expect(response.headers.get('cache-control')).toContain('no-transform')
    expect(response.headers.get('x-accel-buffering')).toBe('no')
    controller.abort()
  })

  it('sends the current score first, then every change at once', async () => {
    changeScore(getDb(), 'bride', 1)
    const controller = new AbortController()
    const response = await GET(streamRequest(cookie, controller.signal))
    const reader = response.body!.getReader()

    const first = await readText(reader)
    expect(first).toContain('retry: 2000')
    expect(first).toContain('data: {"bride":1,"groom":0,"rev":1}\n\n')

    publishScore({ bride: 1, groom: 1, rev: 2 })
    expect(await readText(reader)).toBe('data: {"bride":1,"groom":1,"rev":2}\n\n')
    controller.abort()
  })

  it('sends a ping event so proxies keep the line open and the page can tell it is alive', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const response = await GET(streamRequest(cookie, controller.signal))
    const reader = response.body!.getReader()
    await readText(reader)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(await readText(reader)).toBe('event: ping\ndata: 1\n\n')
    controller.abort()
  })

  it('forgets the subscriber when the client goes away', async () => {
    const controller = new AbortController()
    await GET(streamRequest(cookie, controller.signal))
    expect(scoreSubscriberCount()).toBe(1)
    controller.abort()
    expect(scoreSubscriberCount()).toBe(0)
  })

  it('forgets the subscriber when the stream is cancelled', async () => {
    const response = await GET(streamRequest(cookie))
    const reader = response.body!.getReader()
    expect(scoreSubscriberCount()).toBe(1)
    await reader.cancel()
    expect(scoreSubscriberCount()).toBe(0)
  })

  it('drops a client that does not read anymore instead of piling up messages', async () => {
    await GET(streamRequest(cookie))
    expect(scoreSubscriberCount()).toBe(1)
    for (let n = 1; n <= 40; n++) publishScore({ bride: n, groom: 0, rev: n })
    expect(scoreSubscriberCount()).toBe(0)
  })

  it('refuses further streams beyond the limit', async () => {
    for (let n = 0; n < 50; n++) subscribeScore(() => {})
    const response = await GET(streamRequest(cookie))
    expect(response.status).toBe(429)
    expect(scoreSubscriberCount()).toBe(50)
  })
})
