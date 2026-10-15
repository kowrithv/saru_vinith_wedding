import { guestIp, runPool, summarize } from './lib.mjs'

// Jede Szenario-Funktion liefert { name, sent, ok, failed, latency, checks }.
// "ok" = erwarteter Status; zusätzlich prüfen `checks` die Folgen (nichts
// verloren, nichts doppelt gezählt).

function json(init) {
  return { 'content-type': 'application/json', ...init }
}

async function timed(fetchImpl, url, init) {
  const started = Date.now()
  try {
    const response = await fetchImpl(url, init)
    let data = null
    const text = await response.text()
    try {
      data = JSON.parse(text)
    } catch {
      // keine JSON-Antwort
    }
    return { status: response.status, data, ms: Date.now() - started }
  } catch (error) {
    return { status: 0, data: null, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) }
  }
}

function report(name, outcomes, expectedStatus, checks = []) {
  const accepted = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]
  const ok = outcomes.filter((o) => accepted.includes(o.status)).length
  return {
    name,
    sent: outcomes.length,
    ok,
    failed: outcomes.length - ok,
    latency: summarize(outcomes.map((o) => o.ms)),
    checks,
  }
}

function totalVotes(tally) {
  return Object.values(tally).reduce(
    (sum, perQuestion) => sum + Object.values(perQuestion).reduce((s, n) => s + n, 0),
    0
  )
}

// Die Zähler sind für Gäste verborgen (bis zur Freigabe): lesen lassen sie sich
// nur mit dem Wort der DJ-Seite (--results-key). Ohne es ist das Ergebnis null.
async function readTally(ctx) {
  const init = ctx.resultsKey ? { headers: { 'x-results-key': ctx.resultsKey } } : {}
  const res = await timed(ctx.fetchImpl, `${ctx.baseUrl}/api/who-votes`, init)
  return res.data?.questions ?? null
}

// Fragen und Antworten wie in src/lib/who-game-content.ts.
const WHO_QUESTION_IDS = Array.from({ length: 14 }, (_, i) => String(i + 1))
const WHO_OPTIONS = ['Saruga', 'Vinith', 'Beide']

function acknowledgedAsNew(outcomes) {
  return outcomes.filter((o) => o.status === 200 && o.data?.alreadyVoted === false).length
}

async function votesScenario(ctx) {
  const before = await readTally(ctx)
  const vote = (voterId, questionId, option, ip) =>
    timed(ctx.fetchImpl, `${ctx.baseUrl}/api/who-votes/vote`, {
      method: 'POST',
      headers: json({ 'x-forwarded-for': ip }),
      body: JSON.stringify({ questionId, voterId, option, password: ctx.uploadPassword }),
    })

  const outcomes = await runPool(ctx.guests, ctx.concurrency, (i) =>
    vote(
      `load-${ctx.runId}-${i}`,
      WHO_QUESTION_IDS[i % WHO_QUESTION_IDS.length],
      WHO_OPTIONS[i % WHO_OPTIONS.length],
      guestIp(i)
    )
  )
  const acknowledged = acknowledgedAsNew(outcomes)
  const checks = [
    {
      name: 'jede Stimme bestätigt',
      ok: acknowledged === ctx.guests,
      detail: `${ctx.guests} gesendet, ${acknowledged} als neu bestätigt`,
    },
  ]

  // Dasselbe Gerät stimmt gleichzeitig mehrfach ab: es darf nur eine Stimme zählen.
  const mid = await readTally(ctx)
  const duplicates = await runPool(50, 50, () =>
    vote(`load-${ctx.runId}-dup`, WHO_QUESTION_IDS[0], WHO_OPTIONS[0], '10.250.250.249')
  )
  const duplicateAcks = acknowledgedAsNew(duplicates)
  checks.push({
    name: 'ein Gerät zählt nur einmal (50 gleichzeitige Stimmen)',
    ok: duplicateAcks === 1,
    detail: `${duplicateAcks} als neu bestätigt, erwartet 1`,
  })

  // Mit dem Wort der DJ-Seite lassen sich die Zähler gegenprüfen.
  const after = await readTally(ctx)
  if (before && mid && after) {
    const counted = totalVotes(mid) - totalVotes(before)
    checks.push({
      name: 'jede Stimme gezählt',
      ok: counted === ctx.guests,
      detail: `${ctx.guests} gesendet, ${counted} gezählt${counted < ctx.guests ? ' - Stimmen verloren' : ''}`,
    })
    const duplicateDelta = totalVotes(after) - totalVotes(mid)
    checks.push({
      name: 'Zähler: ein Gerät zählt nur einmal',
      ok: duplicateDelta === 1,
      detail: `${duplicateDelta} gezählt, erwartet 1`,
    })
  }

  return report('Abstimmungen', [...outcomes, ...duplicates], 200, checks)
}

async function guestbookScenario(ctx) {
  const readCount = async () => {
    const res = await timed(ctx.fetchImpl, `${ctx.baseUrl}/api/guestbook`, {})
    return Array.isArray(res.data?.entries) ? res.data.entries.length : -1
  }
  const before = await readCount()
  const outcomes = await runPool(ctx.guests, ctx.concurrency, (i) =>
    timed(ctx.fetchImpl, `${ctx.baseUrl}/api/guestbook`, {
      method: 'POST',
      headers: json({ 'x-forwarded-for': guestIp(i) }),
      body: JSON.stringify({
        name: `Lastgast ${i}`,
        message: `Lasttest ${ctx.runId}: Glückwunsch, Nachricht ${i}.`,
        password: ctx.uploadPassword,
      }),
    })
  )
  const after = await readCount()
  const created = outcomes.filter((o) => o.status === 201).length
  return report('Gästebuch', outcomes, 201, [
    {
      name: 'jeder Eintrag gespeichert',
      ok: after - before === created,
      detail: `${created} bestätigt, ${after - before} neu in der Liste`,
    },
  ])
}

async function memoryRecordScenario(ctx) {
  const readRecord = async () => (await timed(ctx.fetchImpl, `${ctx.baseUrl}/api/memory-record`, {})).data?.record ?? null
  const initial = await readRecord()
  const results = Array.from({ length: ctx.guests }, (_, i) => ({
    moves: 8 + ((i * 7) % 40),
    seconds: 20 + ((i * 13) % 300),
  }))
  const outcomes = await runPool(ctx.guests, ctx.concurrency, (i) =>
    timed(ctx.fetchImpl, `${ctx.baseUrl}/api/memory-record`, {
      method: 'POST',
      headers: json({ 'x-forwarded-for': guestIp(i) }),
      body: JSON.stringify(results[i]),
    })
  )
  const better = (a, b) => !b || a.moves < b.moves || (a.moves === b.moves && a.seconds < b.seconds)
  const expected = results.reduce((best, r) => (better(r, best) ? r : best), initial)
  const final = await readRecord()
  const same = final && expected && final.moves === expected.moves && final.seconds === expected.seconds
  return report('Memory-Rekord', outcomes, 200, [
    {
      name: 'bestes Ergebnis gewinnt (gleichzeitige Meldungen)',
      ok: Boolean(same),
      detail: `erwartet ${expected?.moves}/${expected?.seconds}, gespeichert ${final?.moves}/${final?.seconds}`,
    },
  ])
}

// Im Standard (Kennwort-Modus) liefert die Liste ohne Sitzung nur "gesperrt".
// Mit Kennwort wird deshalb einmal entsperrt und das Cookie mitgeschickt: so
// misst der Test die echte Liste samt aller Fotos.
async function unlockSessionCookie(ctx) {
  try {
    const response = await ctx.fetchImpl(`${ctx.baseUrl}/api/gallery/unlock`, {
      method: 'POST',
      headers: json({ 'x-forwarded-for': guestIp(0) }),
      body: JSON.stringify({ password: ctx.uploadPassword }),
    })
    await response.text()
    if (!response.ok) return null
    return response.headers.get('set-cookie')?.split(';')[0] ?? null
  } catch {
    return null
  }
}

async function galleryScenario(ctx) {
  const cookie = ctx.uploadPassword ? await unlockSessionCookie(ctx) : null
  const outcomes = await runPool(ctx.guests, ctx.concurrency, () =>
    timed(ctx.fetchImpl, `${ctx.baseUrl}/api/gallery`, cookie ? { headers: { cookie } } : {})
  )
  const checks = ctx.uploadPassword
    ? [
        {
          name: 'Liste mit Entsperr-Sitzung abrufbar',
          ok: cookie !== null && outcomes.some((o) => o.data?.unlocked === true),
          detail: cookie === null ? 'Entsperren mit dem Kennwort fehlgeschlagen' : 'Liste war entsperrt',
        },
      ]
    : []
  return report('Galerie-Liste', outcomes, 200, checks)
}

async function pollingScenario(ctx) {
  const outcomes = await runPool(ctx.guests * 4, ctx.concurrency, () =>
    timed(ctx.fetchImpl, `${ctx.baseUrl}/api/who-votes`, {})
  )
  return report('Polling', outcomes, 200)
}

async function uploadTicketsScenario(ctx) {
  const body = (password) =>
    JSON.stringify({
      password,
      category: 'Standesamt',
      files: [{ filename: 'last.jpg', size: 2_000_000, contentType: 'image/jpeg', thumbSize: 150_000 }],
    })
  const outcomes = await runPool(ctx.guests, ctx.concurrency, (i) =>
    timed(ctx.fetchImpl, `${ctx.baseUrl}/api/uploads/request`, {
      method: 'POST',
      headers: json({ 'x-forwarded-for': guestIp(i) }),
      body: body(ctx.uploadPassword),
    })
  )
  // Viele Gäste hinter einer WLAN-Adresse: erfolgreiche Anfragen dürfen das
  // Limit nicht füllen.
  const sameIp = await runPool(60, 20, () =>
    timed(ctx.fetchImpl, `${ctx.baseUrl}/api/uploads/request`, {
      method: 'POST',
      headers: json({ 'x-forwarded-for': '10.250.250.250' }),
      body: body(ctx.uploadPassword),
    })
  )
  const sameIpOk = sameIp.filter((o) => o.status === 200).length
  return report('Upload-Tickets', [...outcomes, ...sameIp], 200, [
    {
      name: 'gemeinsame WLAN-Adresse wird nicht ausgesperrt (60 Anfragen)',
      ok: sameIpOk === 60,
      detail: `${sameIpOk} von 60 erfolgreich`,
    },
  ])
}

async function memoriesScenario(ctx) {
  const outcomes = await runPool(ctx.guests, ctx.concurrency, (i) =>
    timed(ctx.fetchImpl, `${ctx.baseUrl}/api/memories`, {
      method: 'POST',
      headers: json({ 'x-forwarded-for': guestIp(i) }),
      body: JSON.stringify({
        name: `Lastgast ${i}`,
        message: `Lasttest ${ctx.runId}: schöne Erinnerung Nummer ${i}.`,
        password: ctx.uploadPassword,
      }),
    })
  )
  return report('Erinnerungen', outcomes, 201)
}

/**
 * @param {{ baseUrl: string, guests: number, concurrency: number, fetchImpl?: typeof fetch,
 *           uploadPassword?: string, runId?: string }} options
 */
export async function runScenarios(options) {
  const ctx = {
    baseUrl: options.baseUrl.replace(/\/+$/, ''),
    guests: options.guests,
    concurrency: options.concurrency,
    fetchImpl: options.fetchImpl ?? fetch,
    uploadPassword: options.uploadPassword,
    resultsKey: options.resultsKey,
    runId: options.runId ?? String(Date.now()),
  }
  const scenarios = [memoryRecordScenario, galleryScenario, pollingScenario]
  // Abstimmen, Gästebuch, Erinnerungen und Upload brauchen das Gäste-Kennwort.
  if (ctx.uploadPassword) {
    scenarios.unshift(votesScenario)
    scenarios.push(guestbookScenario, uploadTicketsScenario, memoriesScenario)
  }

  const reports = []
  for (const scenario of scenarios) {
    reports.push(await scenario(ctx))
  }
  return reports
}

export function formatLoadReport(reports) {
  const lines = []
  for (const r of reports) {
    const bad = r.failed > 0 || r.checks.some((c) => !c.ok)
    lines.push(
      `${bad ? '✗' : '✓'} ${r.name}: ${r.ok}/${r.sent} ok, p50 ${r.latency.p50} ms, p95 ${r.latency.p95} ms, p99 ${r.latency.p99} ms, max ${r.latency.max} ms`
    )
    for (const c of r.checks) lines.push(`    ${c.ok ? '✓' : '✗'} ${c.name} - ${c.detail}`)
  }
  const failedScenarios = reports.filter((r) => r.failed > 0 || r.checks.some((c) => !c.ok)).length
  lines.push('')
  lines.push(
    failedScenarios === 0
      ? `Alle ${reports.length} Szenarien bestanden.`
      : `${failedScenarios} von ${reports.length} Szenarien mit Befund.`
  )
  return lines.join('\n')
}
