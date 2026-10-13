// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildSmokeChecks, formatReport, runSmokeChecks } from './smoke-checks.mjs'

// Ein kleiner Fake-Server, der sich wie die echte App verhält.
function fakeServer(overrides = {}) {
  const html = '<html><head><title>Saruga &amp; Vinith</title></head><body>Saruga Vinith</body></html>'
  const securityHeaders = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
  }
  const routes = {
    'GET /': () => ({ status: 200, headers: { 'content-type': 'text/html', ...securityHeaders }, body: html }),
    'GET /story': () => ({ status: 200, body: html }),
    'GET /info': () => ({ status: 200, body: html }),
    'GET /gallery': () => ({ status: 200, body: html }),
    'GET /quiz': () => ({ status: 200, body: html }),
    'GET /memory-spiel': () => ({ status: 200, body: html }),
    'GET /memories': () => ({ status: 200, body: html }),
    'GET /guestbook': () => ({ status: 200, body: html }),
    'GET /admin': () => ({ status: 200, body: html }),
    'GET /robots.txt': () => ({ status: 200, body: 'User-Agent: *\nDisallow: /' }),
    'GET /api/health': () => ({ status: 200, json: { ok: true } }),
    'GET /api/gallery': () => ({ status: 200, json: { mode: 'public', unlocked: true, uploadsLocked: false, photos: [] } }),
    'GET /api/memory-record': () => ({ status: 200, json: { record: null } }),
    'GET /api/guestbook': () => ({ status: 200, json: { entries: [] } }),
    'GET /api/who-votes': () => ({ status: 200, json: { questions: { 1: { Saruga: 0 } } } }),
    'GET /does-not-exist': () => ({ status: 404, body: '<meta http-equiv="refresh" content="0;url=/"/>' }),
    'POST /api/uploads/request': () => ({ status: 401, json: { error: 'Falsches Kennwort.' } }),
    ...overrides,
  }
  return async (url, init = {}) => {
    const { pathname } = new URL(url)
    const key = `${init.method ?? 'GET'} ${pathname}`
    const handler = routes[key]
    if (!handler) return new Response('not found', { status: 404 })
    const { status, headers = {}, body, json } = handler(init)
    return new Response(json !== undefined ? JSON.stringify(json) : body, {
      status,
      headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    })
  }
}

describe('runSmokeChecks', () => {
  it('passes against a healthy server', async () => {
    const results = await runSmokeChecks('https://example.de', fakeServer())
    const failed = results.filter((r) => !r.ok)
    expect(failed).toEqual([])
    expect(results.length).toBeGreaterThanOrEqual(15)
  })

  it('reports a page that answers 500', async () => {
    const results = await runSmokeChecks(
      'https://example.de',
      fakeServer({ 'GET /gallery': () => ({ status: 500, body: 'boom' }) })
    )
    const failed = results.filter((r) => !r.ok)
    expect(failed.map((r) => r.name)).toEqual([expect.stringMatching(/gallery/i)])
    expect(failed[0].detail).toMatch(/500/)
  })

  it('reports an API that returns an unexpected shape', async () => {
    const results = await runSmokeChecks(
      'https://example.de',
      fakeServer({ 'GET /api/memory-record': () => ({ status: 200, json: { rekord: 1 } }) })
    )
    expect(results.filter((r) => !r.ok).map((r) => r.name).join()).toMatch(/memory-rekord/i)
  })

  it('notices a missing security header', async () => {
    const results = await runSmokeChecks(
      'https://example.de',
      fakeServer({ 'GET /': () => ({ status: 200, headers: {}, body: 'Saruga Vinith' }) })
    )
    expect(results.filter((r) => !r.ok).map((r) => r.name).join()).toMatch(/header/i)
  })

  it('notices a 404 page that does not redirect home', async () => {
    const results = await runSmokeChecks(
      'https://example.de',
      fakeServer({ 'GET /does-not-exist': () => ({ status: 404, body: 'Not found' }) })
    )
    expect(results.filter((r) => !r.ok).map((r) => r.name).join()).toMatch(/404|weiterleit/i)
  })

  it('turns a network error into a failed check instead of throwing', async () => {
    const results = await runSmokeChecks('https://example.de', async () => {
      throw new Error('ECONNREFUSED')
    })
    expect(results.every((r) => !r.ok)).toBe(true)
    expect(results[0].detail).toMatch(/ECONNREFUSED/)
  })

  it('accepts a paused upload (423) or a wrong-password answer (401) from the upload route, but not a 500', async () => {
    const ok423 = await runSmokeChecks(
      'https://example.de',
      fakeServer({ 'POST /api/uploads/request': () => ({ status: 423, json: { error: 'pausiert' } }) })
    )
    expect(ok423.filter((r) => !r.ok)).toEqual([])

    const bad = await runSmokeChecks(
      'https://example.de',
      fakeServer({ 'POST /api/uploads/request': () => ({ status: 500, json: { error: 'x' } }) })
    )
    expect(bad.filter((r) => !r.ok).map((r) => r.name).join()).toMatch(/upload/i)
  })

  it('normalises a trailing slash in the base URL', async () => {
    const seen = []
    await runSmokeChecks('https://example.de/', async (url, init) => {
      seen.push(url)
      return fakeServer()(url, init)
    })
    expect(seen[0]).toBe('https://example.de/')
    expect(seen.every((url) => !url.includes('//api'))).toBe(true)
  })
})

describe('admin check', () => {
  it('is skipped without a password', () => {
    expect(buildSmokeChecks({}).some((check) => /admin-login/i.test(check.name))).toBe(false)
  })

  it('logs in, reads the four locks and logs out when a password is given', async () => {
    const calls = []
    const server = fakeServer({
      'POST /api/admin/login': (init) => {
        calls.push(['login', init.body])
        return { status: 200, json: { success: true }, headers: { 'set-cookie': 'admin_session=abc; Path=/' } }
      },
      'GET /api/admin/write-lock': (init) => {
        calls.push(['locks', init.headers?.cookie ?? init.headers?.Cookie])
        return {
          status: 200,
          json: { locks: { guestbook: false, memories: false, who_votes: false, gallery_upload: false } },
        }
      },
      'POST /api/admin/logout': () => ({ status: 200, json: { success: true } }),
    })

    const results = await runSmokeChecks('https://example.de', server, { adminPassword: 'geheim' })

    expect(results.filter((r) => !r.ok)).toEqual([])
    expect(calls[0][0]).toBe('login')
    expect(JSON.parse(calls[0][1])).toEqual({ password: 'geheim' })
    expect(calls[1]).toEqual(['locks', 'admin_session=abc'])
  })
})

describe('formatReport', () => {
  it('lists every check with a mark and ends with a summary line', () => {
    const text = formatReport([
      { name: 'Startseite', ok: true, detail: '200', ms: 12 },
      { name: 'API: Health', ok: false, detail: 'Status 503', ms: 30 },
    ])
    expect(text).toMatch(/✓ Startseite/)
    expect(text).toMatch(/✗ API: Health/)
    expect(text).toMatch(/1 von 2 Prüfungen fehlgeschlagen/)
  })

  it('says everything is fine when nothing failed', () => {
    expect(formatReport([{ name: 'A', ok: true, detail: '200', ms: 1 }])).toMatch(/Alle 1 Prüfungen bestanden/)
  })
})
