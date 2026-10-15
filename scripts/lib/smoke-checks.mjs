// Prüfungen für scripts/smoke.mjs. Bewusst ohne Abhängigkeiten und ohne
// Seiteneffekte auf Daten: nur Lesezugriffe, ein Upload-Ticket mit falschem
// Kennwort (wird abgewiesen) und - nur mit Passwort - Admin-Login/-Logout.

const PAGES = ['/story', '/info', '/gallery', '/quiz', '/wer-von-uns', '/dj', '/memory-spiel', '/memories', '/guestbook', '/admin']
const SLOW_MS = 3000

function pass() {
  return null
}

function expectStatus(res, wanted) {
  const list = Array.isArray(wanted) ? wanted : [wanted]
  return list.includes(res.status) ? null : `Status ${res.status}, erwartet ${list.join(' oder ')}`
}

function expectJson(res, test, hint) {
  if (res.status !== 200) return `Status ${res.status}, erwartet 200`
  let data
  try {
    data = JSON.parse(res.text)
  } catch {
    return 'Antwort ist kein JSON'
  }
  return test(data) ? null : `Unerwartete Antwort (${hint})`
}

/**
 * @param {{ adminPassword?: string }} options
 */
export function buildSmokeChecks(options = {}) {
  const checks = []

  checks.push({
    name: 'Seite: Startseite',
    path: '/',
    expect: (res) =>
      expectStatus(res, 200) ??
      (/Saruga/.test(res.text) && /Vinith/.test(res.text) ? null : 'Namen fehlen im HTML'),
  })

  for (const page of PAGES) {
    checks.push({ name: `Seite: ${page}`, path: page, expect: (res) => expectStatus(res, 200) })
  }

  checks.push({
    name: 'robots.txt sperrt Suchmaschinen',
    path: '/robots.txt',
    expect: (res) => expectStatus(res, 200) ?? (/Disallow:\s*\//.test(res.text) ? null : 'Disallow fehlt'),
  })

  checks.push({
    name: 'API: Health',
    path: '/api/health',
    expect: (res) => expectJson(res, (d) => d.ok === true, 'ok: true erwartet'),
  })
  checks.push({
    name: 'API: Galerie-Liste',
    path: '/api/gallery',
    expect: (res) =>
      expectJson(res, (d) => 'mode' in d && 'unlocked' in d, 'mode und unlocked erwartet'),
  })
  checks.push({
    name: 'API: Memory-Rekord',
    path: '/api/memory-record',
    expect: (res) => expectJson(res, (d) => 'record' in d, 'record erwartet'),
  })
  checks.push({
    name: 'API: Gästebuch',
    path: '/api/guestbook',
    expect: (res) => expectJson(res, (d) => Array.isArray(d.entries), 'entries-Liste erwartet'),
  })
  checks.push({
    name: 'API: Wer-von-uns-Stand',
    path: '/api/who-votes',
    // Ohne Freigabe bleiben die Zähler verborgen (questions: null).
    expect: (res) =>
      expectJson(
        res,
        (d) => typeof d.released === 'boolean' && 'questions' in d,
        'released und questions erwartet'
      ),
  })

  checks.push({
    name: 'Unbekannte URL: 404 mit Weiterleitung auf die Startseite',
    path: '/does-not-exist',
    expect: (res) =>
      expectStatus(res, 404) ??
      (/http-equiv="refresh"/.test(res.text) ? null : 'Meta-Refresh zur Startseite fehlt'),
  })

  checks.push({
    name: 'Sicherheits-Header auf der Startseite',
    path: '/',
    expect: (res) => {
      const missing = []
      if (res.headers.get('x-content-type-options') !== 'nosniff') missing.push('X-Content-Type-Options')
      if (res.headers.get('x-frame-options') !== 'DENY') missing.push('X-Frame-Options')
      if (!res.headers.get('referrer-policy')) missing.push('Referrer-Policy')
      return missing.length ? `Header fehlen: ${missing.join(', ')}` : null
    },
  })

  checks.push({
    name: 'Upload-Route antwortet (Ticket mit falschem Kennwort wird abgewiesen)',
    path: '/api/uploads/request',
    method: 'POST',
    body: JSON.stringify({
      password: 'smoke-test-falsch',
      category: 'Standesamt',
      files: [{ filename: 'smoke.jpg', size: 1000, contentType: 'image/jpeg', thumbSize: 1000 }],
    }),
    // 401 = Kennwort geprüft, 423 = Upload pausiert, 429 = Limit - alle zeigen
    // eine lebende Route. Ein 5xx oder ein Ticket (200) wäre ein Befund.
    expect: (res) => expectStatus(res, [401, 423, 429]),
  })

  if (options.adminPassword) {
    checks.push({
      name: 'Admin-Login, Sperren lesen und Abmelden',
      kind: 'admin',
      password: options.adminPassword,
    })
  }

  return checks
}

async function timedFetch(fetchImpl, url, init) {
  const started = Date.now()
  const response = await fetchImpl(url, { redirect: 'manual', ...init })
  const text = await response.text()
  return { status: response.status, headers: response.headers, text, ms: Date.now() - started }
}

async function runAdminCheck(fetchImpl, baseUrl, password) {
  const login = await timedFetch(fetchImpl, `${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (login.status !== 200) return { ok: false, detail: `Login Status ${login.status}`, ms: login.ms }
  const setCookie = login.headers.get('set-cookie') ?? ''
  const cookie = setCookie.split(';')[0]
  if (!cookie) return { ok: false, detail: 'Login ohne Cookie', ms: login.ms }

  const locks = await timedFetch(fetchImpl, `${baseUrl}/api/admin/write-lock`, { headers: { cookie } })
  let ok = locks.status === 200
  let detail = `Status ${locks.status}`
  if (ok) {
    try {
      const data = JSON.parse(locks.text)
      const keys = Object.keys(data.locks ?? {})
      ok = ['guestbook', 'memories', 'who_votes', 'gallery_upload', 'memory_photos'].every((key) => keys.includes(key))
      detail = ok ? 'vier Schalter lesbar' : `Schalter unvollständig: ${keys.join(', ')}`
    } catch {
      ok = false
      detail = 'Antwort ist kein JSON'
    }
  }

  await timedFetch(fetchImpl, `${baseUrl}/api/admin/logout`, { method: 'POST', headers: { cookie } })
  return { ok, detail, ms: login.ms + locks.ms }
}

/**
 * Führt alle Prüfungen nacheinander aus (kein Lasttest) und liefert je
 * Prüfung { name, ok, detail, ms }. Wirft nie: Netzwerkfehler sind Befunde.
 */
export async function runSmokeChecks(baseUrl, fetchImpl = fetch, options = {}) {
  const base = baseUrl.replace(/\/+$/, '')
  const results = []
  for (const check of buildSmokeChecks(options)) {
    try {
      if (check.kind === 'admin') {
        const outcome = await runAdminCheck(fetchImpl, base, check.password)
        results.push({ name: check.name, ...outcome })
        continue
      }
      const res = await timedFetch(fetchImpl, `${base}${check.path}`, {
        method: check.method ?? 'GET',
        headers: check.body ? { 'content-type': 'application/json' } : undefined,
        body: check.body,
      })
      const problem = check.expect(res)
      const slow = res.ms > SLOW_MS ? ` (langsam: ${res.ms} ms)` : ''
      results.push({
        name: check.name,
        ok: problem === null,
        detail: problem ?? `Status ${res.status}${slow}`,
        ms: res.ms,
      })
    } catch (error) {
      results.push({
        name: check.name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
        ms: 0,
      })
    }
  }
  return results
}

export function formatReport(results) {
  const lines = results.map(
    (r) => `${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ` - ${r.detail}`}${r.ms ? ` (${r.ms} ms)` : ''}`
  )
  const failed = results.filter((r) => !r.ok).length
  lines.push('')
  lines.push(
    failed === 0
      ? `Alle ${results.length} Prüfungen bestanden.`
      : `${failed} von ${results.length} Prüfungen fehlgeschlagen.`
  )
  return lines.join('\n')
}
