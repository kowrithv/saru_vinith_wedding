// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { runScenarios } from './scenarios.mjs'

// Fake-Server mit denselben Eigenschaften wie die echte App (eine Stimme je
// Frage und Gerät, Gästebuch, Rekord), plus Schalter, die Fehler einbauen.
function createFakeServer(options = {}) {
  const votes = new Map() // `${question}:${voter}` -> option
  const guestbook = []
  let record = null
  const questions = ['1', '2', '3']
  const choices = ['Saruga', 'Vinith', 'Beide']

  const json = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  return async (url, init = {}) => {
    const { pathname } = new URL(url)
    const method = init.method ?? 'GET'
    const body = init.body ? JSON.parse(init.body) : undefined

    if (pathname === '/api/who-votes' && method === 'GET') {
      const tally = {}
      for (const q of questions) {
        tally[q] = Object.fromEntries(choices.map((c) => [c, 0]))
      }
      for (const [key, option] of votes) tally[key.split(':')[0]][option]++
      return json(200, { questions: tally })
    }
    if (pathname === '/api/who-votes/vote') {
      if (options.dropEveryNthVote && votes.size % options.dropEveryNthVote === options.dropEveryNthVote - 1) {
        return json(200, { tally: {}, alreadyVoted: false }) // "bestätigt", aber nicht gespeichert
      }
      const key = `${body.questionId}:${body.voterId}`
      const already = votes.has(key)
      if (!already) votes.set(key, body.option)
      return json(200, { tally: {}, alreadyVoted: already })
    }
    if (pathname === '/api/guestbook' && method === 'GET') return json(200, { entries: guestbook })
    if (pathname === '/api/guestbook' && method === 'POST') {
      // Gästebuch-Einträge brauchen wie in der App das Kennwort vom Empfang.
      if (body.password !== 'empfang') return json(401, { error: 'Falsches Kennwort.' })
      guestbook.push(body)
      return json(201, { entry: body })
    }
    if (pathname === '/api/memory-record' && method === 'GET') return json(200, { record })
    if (pathname === '/api/memory-record' && method === 'POST') {
      const better =
        !record || body.moves < record.moves || (body.moves === record.moves && body.seconds < record.seconds)
      if (better) record = { moves: body.moves, seconds: body.seconds }
      return json(200, { record, isNewRecord: better })
    }
    if (pathname === '/api/gallery/unlock' && method === 'POST') {
      if (options.rejectUnlock || body.password !== 'empfang') return json(401, { error: 'Falsches Kennwort.' })
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'set-cookie': 'gallery_session=ok; Path=/; HttpOnly' },
      })
    }
    if (pathname === '/api/gallery') {
      // Kennwort-Modus (Standard): ohne Sitzung gibt es keine Liste.
      const unlocked = String(init.headers?.cookie ?? '').includes('gallery_session=ok')
      return json(200, { mode: 'password', unlocked, photos: unlocked ? [] : null })
    }
    if (pathname === '/api/uploads/request') {
      if (body.password !== 'empfang') return json(401, { error: 'Falsches Kennwort.' })
      return json(200, { tickets: [{ photoId: 'p', ticket: 't' }] })
    }
    if (pathname === '/api/memories' && method === 'POST') {
      return body.password === 'empfang' ? json(201, { entry: body }) : json(401, { error: 'x' })
    }
    return json(404, { error: 'unbekannt' })
  }
}

describe('runScenarios', () => {
  it('passes against a correct server', async () => {
    const reports = await runScenarios({
      baseUrl: 'http://localhost:3000',
      guests: 60,
      concurrency: 20,
      fetchImpl: createFakeServer(),
      uploadPassword: 'empfang',
      runId: 'test',
    })

    const failed = reports.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => `${r.name}: ${c.name}`))
    expect(failed).toEqual([])
    expect(reports.map((r) => r.name)).toEqual(
      expect.arrayContaining(['Abstimmungen', 'Gästebuch', 'Memory-Rekord', 'Galerie-Liste', 'Polling', 'Upload-Tickets'])
    )
    for (const report of reports) {
      expect(report.sent).toBeGreaterThan(0)
      expect(report.failed).toBe(0)
    }
  })

  it('detects votes that were acknowledged but not stored', async () => {
    const reports = await runScenarios({
      baseUrl: 'http://localhost:3000',
      guests: 60,
      concurrency: 20,
      fetchImpl: createFakeServer({ dropEveryNthVote: 7 }),
      runId: 'lossy',
    })

    const votes = reports.find((r) => r.name === 'Abstimmungen')
    expect(votes.checks.some((c) => !c.ok && /verloren|gezählt/i.test(c.detail))).toBe(true)
  })

  it('counts a server error as a failed request and keeps running', async () => {
    const base = createFakeServer()
    const reports = await runScenarios({
      baseUrl: 'http://localhost:3000',
      guests: 20,
      concurrency: 10,
      fetchImpl: async (url, init) => {
        if (new URL(url).pathname === '/api/gallery') return new Response('boom', { status: 500 })
        return base(url, init)
      },
      uploadPassword: 'empfang',
      runId: 'err',
    })
    const gallery = reports.find((r) => r.name === 'Galerie-Liste')
    expect(gallery.failed).toBe(20)
    expect(reports.find((r) => r.name === 'Gästebuch').failed).toBe(0)
  })

  it('lists the gallery with an unlocked session so the real list is measured', async () => {
    const reports = await runScenarios({
      baseUrl: 'http://localhost:3000',
      guests: 10,
      concurrency: 5,
      fetchImpl: createFakeServer(),
      uploadPassword: 'empfang',
      runId: 'unlocked',
    })
    const gallery = reports.find((r) => r.name === 'Galerie-Liste')
    expect(gallery.checks.map((c) => [c.name, c.ok])).toEqual([['Liste mit Entsperr-Sitzung abrufbar', true]])
  })

  it('reports a finding when the gallery cannot be unlocked with the given password', async () => {
    const reports = await runScenarios({
      baseUrl: 'http://localhost:3000',
      guests: 10,
      concurrency: 5,
      fetchImpl: createFakeServer({ rejectUnlock: true }),
      uploadPassword: 'empfang',
      runId: 'locked',
    })
    const gallery = reports.find((r) => r.name === 'Galerie-Liste')
    expect(gallery.checks.some((c) => !c.ok)).toBe(true)
  })

  it('skips the scenarios that need the guest password when none is given', async () => {
    const reports = await runScenarios({
      baseUrl: 'http://localhost:3000',
      guests: 10,
      concurrency: 5,
      fetchImpl: createFakeServer(),
      runId: 'nopw',
    })
    expect(reports.map((r) => r.name)).not.toContain('Upload-Tickets')
    expect(reports.map((r) => r.name)).not.toContain('Erinnerungen')
    expect(reports.map((r) => r.name)).not.toContain('Gästebuch')
  })
})
