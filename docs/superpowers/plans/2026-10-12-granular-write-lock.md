# Feingranulare Schreib-Sperre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die bisher eine gemeinsame Schreib-Sperre (Gästebuch +
Erinnerungen zusammen) durch drei unabhängige Sperren ersetzen:
Gästebuch, Erinnerungen, Wer-von-uns-Abstimmung — jede einzeln im
Admin-Dashboard umschaltbar.

**Architecture:** `app_config` bekommt drei eigene Keys statt eines
gemeinsamen (`guestbook_locked`, `memories_locked`,
`who_votes_locked`) über eine neue, parametrisierte
`isFeatureLocked`/`setFeatureLocked`-Funktion, die die bisherigen
`isWritesLocked`/`setWritesLocked` ersetzt (keine Rückwärtskompatibilität
nötig - beide Funktionen wurden im selben Rewrite gebaut, nichts
Externes hängt daran). Der Admin-API-Endpunkt wird
Feature-bewusst: `GET` liefert alle drei Zustände auf einmal (dient
weiterhin zugleich als Auth-Check für die Dashboard-Seite), `POST`
setzt gezielt eines der drei Features.

**Tech Stack:** Next.js App Router · React 19 · better-sqlite3
(bestehendes Schema) · Zod · Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-11-rewrite-design.md`

## Global Constraints

- Die Spec nennt die Schreib-Sperre ursprünglich nur für
  "Gästebuch-/Erinnerungs-Einträge" - die Erweiterung auf die
  Wer-von-uns-Abstimmung ist eine explizite Nutzer-Entscheidung aus
  diesem Gespräch, keine Spec-Vorgabe. Admin-Löschung und GET (Lesen)
  bleiben für alle drei Features unangetastet - exakt dieselbe bereits
  etablierte Regel wie bei der bisherigen gemeinsamen Sperre.
- Keine Rückwärtskompatibilität für `isWritesLocked`/`setWritesLocked`
  oder den alten `{locked: boolean}`-Response: beide werden komplett
  ersetzt, alle Aufrufer in diesem Plan mit aktualisiert.
- TDD ist Pflicht für jede Funktion/Komponente mit eigener Logik.

## Review Focus

- Das Sperren eines Features darf die anderen beiden nicht
  beeinflussen - ein Test muss das für jede Kombination explizit
  zeigen, nicht nur implizit annehmen.
- Die Wer-von-uns-Sperre darf nur `POST /api/who-votes/vote`
  blockieren - `GET /api/who-votes` (Live-Ergebnisse lesen) muss auch
  bei aktiver Sperre weiterlaufen, exakt wie bei Gästebuch/Erinnerungen.
- Ein POST mit einem unbekannten `feature`-Wert muss abgelehnt werden,
  nicht stillschweigend ignoriert oder als eines der drei bekannten
  Features fehlinterpretiert werden.
- Das Dashboard darf beim Umschalten eines Features niemals die
  Anzeige der beiden anderen Features verändern, auch nicht kurzzeitig.
- Ein Gast, der während aktiver Wer-von-uns-Sperre abstimmen will, muss
  eine verständliche deutsche Fehlermeldung sehen (entsprechend der
  bereits für Gästebuch/Erinnerungen gelösten Review-Vorgabe aus dem
  vorherigen Plan).

---

## Task 1: Feature-Sperren-Primitive & Durchsetzung in allen drei Routen

**Files:**
- Modify: `src/lib/app-config.ts`
- Test: `src/lib/app-config.test.ts`
- Modify: `src/app/api/guestbook/route.ts`
- Test: `src/app/api/guestbook/route.test.ts` (ergänzen)
- Modify: `src/app/api/memories/route.ts`
- Test: `src/app/api/memories/route.test.ts` (ergänzen)
- Modify: `src/app/api/who-votes/vote/route.ts`
- Test: `src/app/api/who-votes/vote/route.test.ts` (ergänzen)

**Interfaces:**
- Produces: `type LockableFeature = 'guestbook' | 'memories' | 'who_votes'`,
  `isFeatureLocked(db, feature: LockableFeature): boolean`,
  `setFeatureLocked(db, feature: LockableFeature, locked: boolean): void`.
  Ersetzt `isWritesLocked`/`setWritesLocked` vollständig. Von Task 2
  (Admin-API) und von diesem Task's eigenen drei POST-Routen konsumiert.

- [ ] **Step 1: Test für die Zugriffsschicht schreiben**

```ts
// src/lib/app-config.test.ts (vollständige neue Fassung)
import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { isFeatureLocked, setFeatureLocked } from './app-config'

describe('app-config feature locks', () => {
  it('defaults to unlocked for each feature independently', () => {
    const db = createDb(':memory:')
    expect(isFeatureLocked(db, 'guestbook')).toBe(false)
    expect(isFeatureLocked(db, 'memories')).toBe(false)
    expect(isFeatureLocked(db, 'who_votes')).toBe(false)
    db.close()
  })

  it('locks one feature without affecting the other two', () => {
    const db = createDb(':memory:')
    setFeatureLocked(db, 'guestbook', true)

    expect(isFeatureLocked(db, 'guestbook')).toBe(true)
    expect(isFeatureLocked(db, 'memories')).toBe(false)
    expect(isFeatureLocked(db, 'who_votes')).toBe(false)
    db.close()
  })

  it('locks and unlocks the who_votes feature independently of the others', () => {
    const db = createDb(':memory:')
    setFeatureLocked(db, 'guestbook', true)
    setFeatureLocked(db, 'who_votes', true)
    setFeatureLocked(db, 'who_votes', false)

    expect(isFeatureLocked(db, 'guestbook')).toBe(true)
    expect(isFeatureLocked(db, 'memories')).toBe(false)
    expect(isFeatureLocked(db, 'who_votes')).toBe(false)
    db.close()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/app-config.test.ts`
Expected: FAIL — `isFeatureLocked is not a function` (bzw. Importfehler)

- [ ] **Step 3: Zugriffsschicht implementieren**

```ts
// src/lib/app-config.ts (vollständige neue Fassung)
import type Database from 'better-sqlite3'

export type LockableFeature = 'guestbook' | 'memories' | 'who_votes'

const LOCK_KEYS: Record<LockableFeature, string> = {
  guestbook: 'guestbook_locked',
  memories: 'memories_locked',
  who_votes: 'who_votes_locked',
}

export function isFeatureLocked(db: Database.Database, feature: LockableFeature): boolean {
  const row = db
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .get(LOCK_KEYS[feature]) as { value: string } | undefined
  return row?.value === 'true'
}

export function setFeatureLocked(db: Database.Database, feature: LockableFeature, locked: boolean): void {
  db.prepare(
    'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(LOCK_KEYS[feature], locked ? 'true' : 'false')
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/app-config.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Bestehende Gästebuch/Erinnerungen-Tests auf die neue API
  umstellen**

```ts
// src/app/api/guestbook/route.test.ts - Import und betroffene Tests anpassen
import { setFeatureLocked } from '@/lib/app-config'
import { getDb } from '@/lib/db'

// "rejects a new entry with 423 while writes are locked..." - Body ersetzen:
it('rejects a new entry with 423 while guestbook writes are locked, but GET still works', async () => {
  setFeatureLocked(getDb(), 'guestbook', true)

  const response = await POST(
    postRequest({ name: 'Anna', message: 'Eine Nachricht während der Sperre.' })
  )
  expect(response.status).toBe(423)

  const getResponse = await GET()
  expect(getResponse.status).toBe(200)
})

// "accepts a new entry again once writes are unlocked" - Body ersetzen:
it('accepts a new entry again once guestbook writes are unlocked', async () => {
  setFeatureLocked(getDb(), 'guestbook', true)
  setFeatureLocked(getDb(), 'guestbook', false)

  const response = await POST(
    postRequest({ name: 'Anna', message: 'Eine Nachricht nach dem Entsperren.' })
  )
  expect(response.status).toBe(201)
})

// Neuer Test: Review Focus "darf die anderen beiden nicht beeinflussen"
it('locking memories or who_votes does not block guestbook', async () => {
  setFeatureLocked(getDb(), 'memories', true)
  setFeatureLocked(getDb(), 'who_votes', true)

  const response = await POST(
    postRequest({ name: 'Anna', message: 'Gästebuch bleibt offen.' })
  )
  expect(response.status).toBe(201)
})
```

```ts
// src/app/api/memories/route.test.ts - Import und betroffenen Test anpassen
import { setFeatureLocked } from '@/lib/app-config'
import { getDb } from '@/lib/db'

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
```

- [ ] **Step 6: Test für die Wer-von-uns-Sperre schreiben**

```ts
// Ergänzung in src/app/api/who-votes/vote/route.test.ts
import { setFeatureLocked } from '@/lib/app-config'
import { getDb } from '@/lib/db'

it('rejects a vote with 423 while who_votes is locked, but the tally GET still works', async () => {
  setFeatureLocked(getDb(), 'who_votes', true)

  const response = await POST(
    postRequest({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[0] })
  )
  expect(response.status).toBe(423)
})

it('locking guestbook or memories does not block voting', async () => {
  setFeatureLocked(getDb(), 'guestbook', true)
  setFeatureLocked(getDb(), 'memories', true)

  const response = await POST(
    postRequest({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[0] })
  )
  expect(response.status).toBe(200)
})
```

- [ ] **Step 7: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/guestbook/route.test.ts src/app/api/memories/route.test.ts src/app/api/who-votes/vote/route.test.ts`
Expected: FAIL — `setFeatureLocked is not a function` in den ersten beiden
Dateien (alte `setWritesLocked`-Importe entfernt, neue Funktion noch
nicht im Code nutzbar); die neuen Wer-von-uns-Tests erwarten 423, Route
kennt die Sperre noch nicht (immer 200)

- [ ] **Step 8: Durchsetzung in allen drei POST-Routen ergänzen**

```ts
// src/app/api/guestbook/route.ts - Import und Prüfung anpassen
import { isFeatureLocked } from '@/lib/app-config'

// ... im POST-Handler, direkt nach dem Rate-Limit-Check:
  if (isFeatureLocked(getDb(), 'guestbook')) {
    return NextResponse.json(
      { error: 'Neue Einträge sind derzeit vorübergehend gesperrt.' },
      { status: 423 }
    )
  }
```

```ts
// src/app/api/memories/route.ts - Import und Prüfung anpassen
import { isFeatureLocked } from '@/lib/app-config'

// ... im POST-Handler, direkt nach dem Rate-Limit-Check:
  if (isFeatureLocked(getDb(), 'memories')) {
    return NextResponse.json(
      { error: 'Neue Einträge sind derzeit vorübergehend gesperrt.' },
      { status: 423 }
    )
  }
```

```ts
// src/app/api/who-votes/vote/route.ts (vollständige neue Fassung)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { castVote } from '@/lib/who-votes'
import { isFeatureLocked } from '@/lib/app-config'

const voteSchema = z.object({
  questionId: z.string().min(1).max(50),
  voterId: z.string().min(1).max(100),
  option: z.string().min(1).max(50),
})

export async function POST(request: Request): Promise<Response> {
  const db = getDb()

  if (isFeatureLocked(db, 'who_votes')) {
    return NextResponse.json(
      { error: 'Abstimmen ist derzeit vorübergehend gesperrt.' },
      { status: 423 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = voteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  try {
    const result = castVote(db, parsed.data.questionId, parsed.data.voterId, parsed.data.option)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Unbekannte Frage oder Antwort.' }, { status: 400 })
  }
}
```

- [ ] **Step 9: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/guestbook/route.test.ts src/app/api/memories/route.test.ts src/app/api/who-votes/vote/route.test.ts`
Expected: PASS (alle drei Dateien)

- [ ] **Step 10: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 11: Commit**

```bash
git add src/lib/app-config.ts src/lib/app-config.test.ts \
  src/app/api/guestbook/route.ts src/app/api/guestbook/route.test.ts \
  src/app/api/memories/route.ts src/app/api/memories/route.test.ts \
  src/app/api/who-votes/vote/route.ts src/app/api/who-votes/vote/route.test.ts
git commit -m "Split the writes-locked switch into three independent per-feature locks"
```

---

## Task 2: Admin-API auf Feature-Ebene

**Files:**
- Modify: `src/app/api/admin/write-lock/route.ts`
- Test: `src/app/api/admin/write-lock/route.test.ts` (vollständig neu)

**Interfaces:**
- Consumes: `LockableFeature`, `isFeatureLocked`, `setFeatureLocked` (Task 1).
- Produces: `GET /api/admin/write-lock` → `{ locks: Record<LockableFeature, boolean> }`,
  `POST /api/admin/write-lock` (Body `{ feature: LockableFeature, locked: boolean }`)
  → `{ locks: Record<LockableFeature, boolean> }` (immer der volle, aktuelle
  Stand aller drei Features, nicht nur das geänderte - vermeidet
  Teil-Merge-Fehler auf der Client-Seite). Ersetzt die bisherige
  `{ locked: boolean }`-Form vollständig. Von Task 3 (Dashboard, Admin-Seite)
  konsumiert.

- [ ] **Step 1: Test schreiben**

```ts
// src/app/api/admin/write-lock/route.test.ts (vollständige neue Fassung)
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'
import { getDb } from '@/lib/db'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'

function requestWithCookie(method: string, cookieValue?: string, body?: unknown): Request {
  const headers = new Headers()
  if (cookieValue !== undefined) {
    headers.set('cookie', `${ADMIN_COOKIE_NAME}=${cookieValue}`)
  }
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  return new Request('http://localhost/api/admin/write-lock', {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('/api/admin/write-lock', () => {
  const originalPath = process.env.DATABASE_PATH

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
  })

  it('GET rejects a request without a valid admin cookie', async () => {
    const response = await GET(requestWithCookie('GET'))
    expect(response.status).toBe(401)
  })

  it('GET returns all three lock states (false by default) for an admin', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await GET(requestWithCookie('GET', cookieValue))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.locks).toEqual({ guestbook: false, memories: false, who_votes: false })
  })

  it('POST rejects a request without a valid admin cookie', async () => {
    const response = await POST(requestWithCookie('POST', undefined, { feature: 'guestbook', locked: true }))
    expect(response.status).toBe(401)
  })

  it('POST updates only the targeted feature, and a subsequent GET reflects it', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const postResponse = await POST(
      requestWithCookie('POST', cookieValue, { feature: 'guestbook', locked: true })
    )
    expect(postResponse.status).toBe(200)
    const postBody = await postResponse.json()
    expect(postBody.locks).toEqual({ guestbook: true, memories: false, who_votes: false })

    const getResponse = await GET(requestWithCookie('GET', cookieValue))
    const getBody = await getResponse.json()
    expect(getBody.locks).toEqual({ guestbook: true, memories: false, who_votes: false })
  })

  it('POST rejects an unknown feature value', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await POST(
      requestWithCookie('POST', cookieValue, { feature: 'gallery', locked: true })
    )
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/admin/write-lock/route.test.ts`
Expected: FAIL — bestehende Route liefert noch `{locked: boolean}`, kein
`locks`-Objekt; `feature`-Body-Feld wird noch nicht geprüft

- [ ] **Step 3: Route implementieren**

```ts
// src/app/api/admin/write-lock/route.ts (vollständige neue Fassung)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type Database from 'better-sqlite3'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { isFeatureLocked, setFeatureLocked, type LockableFeature } from '@/lib/app-config'

const FEATURES: LockableFeature[] = ['guestbook', 'memories', 'who_votes']

const bodySchema = z.object({
  feature: z.enum(['guestbook', 'memories', 'who_votes']),
  locked: z.boolean(),
})

function allLocks(db: Database.Database): Record<LockableFeature, boolean> {
  return Object.fromEntries(
    FEATURES.map((feature) => [feature, isFeatureLocked(db, feature)])
  ) as Record<LockableFeature, boolean>
}

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }
  return NextResponse.json({ locks: allLocks(db) })
}

export async function POST(request: Request): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  setFeatureLocked(db, parsed.data.feature, parsed.data.locked)
  return NextResponse.json({ locks: allLocks(db) })
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/admin/write-lock/route.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/write-lock/route.ts src/app/api/admin/write-lock/route.test.ts
git commit -m "Make the admin write-lock API feature-aware"
```

---

## Task 3: Drei unabhängige Schalter im Dashboard

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`
- Test: `src/components/admin/AdminDashboard.test.tsx`
- Modify: `src/app/admin/page.tsx`
- Test: `src/app/admin/page.test.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/admin/write-lock` (Task 2, neue `locks`-Form).
- Produces: `AdminDashboard`s Prop wird zu
  `initialLocks: Record<'guestbook' | 'memories' | 'who_votes', boolean>`
  (ersetzt `initialLocked: boolean`).

- [ ] **Step 1: Test für `AdminDashboard` schreiben**

```tsx
// src/components/admin/AdminDashboard.test.tsx (vollständige neue Fassung)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminDashboard from './AdminDashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function mockFetchSequence(responses: { status?: number; body: unknown }[]) {
  const fn = vi.fn()
  responses.forEach(({ status = 200, body }) => {
    fn.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const noLocks = { guestbook: false, memories: false, who_votes: false }

describe('AdminDashboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and shows guestbook and memories entries', async () => {
    mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [{ id: 5, name: 'Ben', message: 'Schöne Erinnerung an euch.', photoKey: null, createdAt: '2026-10-11T11:00:00.000Z' }] } },
    ])

    render(<AdminDashboard initialLocks={noLocks} />)

    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())
    expect(screen.getByText(/Schöne Erinnerung an euch\./)).toBeInTheDocument()
  })

  it('shows three independent switches, all unlocked by default', async () => {
    const fetchMock = mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }])
    render(<AdminDashboard initialLocks={noLocks} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: /erinnerungen/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: /wer-von-uns/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggling one feature does not change the display of the other two', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { body: { locks: { guestbook: true, memories: false, who_votes: false } } },
    ])
    render(<AdminDashboard initialLocks={noLocks} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    await userEvent.click(screen.getByRole('switch', { name: /gästebuch/i }))

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'true')
    )
    expect(screen.getByRole('switch', { name: /erinnerungen/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: /wer-von-uns/i })).toHaveAttribute('aria-checked', 'false')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/write-lock',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ feature: 'guestbook', locked: true }) })
    )
  })

  it('removes an entry from the list only after the server confirms deletion', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [] } },
      { status: 200, body: { success: true } },
    ])

    render(<AdminDashboard initialLocks={noLocks} />)
    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*Anna/i }))

    await waitFor(() => expect(screen.queryByText('Herzlichen Glückwunsch euch!')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/guestbook/1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('does not remove the entry if the server delete fails', async () => {
    mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [] } },
      { status: 500, body: { error: 'Serverfehler' } },
    ])

    render(<AdminDashboard initialLocks={noLocks} />)
    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*Anna/i }))

    await waitFor(() => expect(screen.getByText(/löschen fehlgeschlagen/i)).toBeInTheDocument())
    expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument()
  })

  it('shows an error and leaves the switches unchanged when toggling fails', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { status: 500, body: { error: 'Serverfehler' } },
    ])

    render(<AdminDashboard initialLocks={noLocks} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const toggle = screen.getByRole('switch', { name: /gästebuch/i })
    await userEvent.click(toggle)

    await waitFor(() => expect(screen.getByText(/umschalten fehlgeschlagen/i)).toBeInTheDocument())
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/admin/AdminDashboard.test.tsx`
Expected: FAIL — `initialLocks`-Prop existiert noch nicht, nur ein
einzelner Schalter vorhanden statt drei

- [ ] **Step 3: `AdminDashboard` umbauen**

```tsx
// src/components/admin/AdminDashboard.tsx (vollständige neue Fassung)
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, ShieldAlert, Trash2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import SectionTitle from '@/components/ui/SectionTitle'
import { cn } from '@/lib/utils'

interface GuestbookEntry {
  id: number
  name: string
  message: string
  createdAt: string
}

interface MemoryEntry {
  id: number
  name: string
  message: string
  photoKey: string | null
  createdAt: string
}

interface Locks {
  guestbook: boolean
  memories: boolean
  who_votes: boolean
}

interface AdminDashboardProps {
  initialLocks: Locks
}

const FEATURE_LABELS: Record<keyof Locks, string> = {
  guestbook: 'Gästebuch',
  memories: 'Erinnerungen',
  who_votes: 'Wer-von-uns-Abstimmung',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminDashboard({ initialLocks }: AdminDashboardProps) {
  const router = useRouter()
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([])
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([])
  const [locks, setLocks] = useState<Locks>(initialLocks)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [lockError, setLockError] = useState<string | null>(null)
  const [togglingFeature, setTogglingFeature] = useState<keyof Locks | null>(null)

  useEffect(() => {
    fetch('/api/guestbook')
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data: { entries: GuestbookEntry[] }) => setGuestbookEntries(data.entries))
      .catch(() => {})

    fetch('/api/memories')
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data: { entries: MemoryEntry[] }) => setMemoryEntries(data.entries))
      .catch(() => {})
  }, [])

  const deleteGuestbookEntry = async (id: number) => {
    setDeleteError(null)
    try {
      const response = await fetch(`/api/guestbook/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
        return
      }
      setGuestbookEntries((prev) => prev.filter((entry) => entry.id !== id))
    } catch {
      setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
    }
  }

  const deleteMemoryEntry = async (id: number) => {
    setDeleteError(null)
    try {
      const response = await fetch(`/api/memories/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
        return
      }
      setMemoryEntries((prev) => prev.filter((entry) => entry.id !== id))
    } catch {
      setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
    }
  }

  const toggleLock = async (feature: keyof Locks) => {
    const next = !locks[feature]
    setLockError(null)
    setTogglingFeature(feature)
    try {
      const response = await fetch('/api/admin/write-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, locked: next }),
      })
      if (!response.ok) {
        setLockError('Umschalten fehlgeschlagen. Bitte versuch es erneut.')
        return
      }
      const data = (await response.json()) as { locks: Locks }
      setLocks(data.locks)
    } catch {
      setLockError('Umschalten fehlgeschlagen. Bitte versuch es erneut.')
    } finally {
      setTogglingFeature(null)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-start justify-between gap-4 mb-8">
          <SectionTitle title="Admin" subtitle="Einträge moderieren, Schreib-Sperren umschalten." centered={false} />
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-dark-blue transition-colors flex-shrink-0"
          >
            <LogOut size={16} />
            Abmelden
          </button>
        </div>

        <Card padding="lg" className="mb-8">
          <div className="space-y-5">
            {(Object.keys(FEATURE_LABELS) as (keyof Locks)[]).map((feature) => {
              const isLocked = locks[feature]
              return (
                <div key={feature} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldAlert size={20} className={isLocked ? 'text-red-600' : 'text-gray-400'} />
                    <div>
                      <p className="font-semibold text-dark-blue text-sm">{FEATURE_LABELS[feature]}</p>
                      <p className="text-xs text-gray-400">{isLocked ? 'Gesperrt.' : 'Erlaubt.'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isLocked}
                    aria-label={`Schreib-Sperre: ${FEATURE_LABELS[feature]}`}
                    onClick={() => toggleLock(feature)}
                    disabled={togglingFeature === feature}
                    className={cn(
                      'w-12 h-7 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50',
                      isLocked ? 'bg-red-500' : 'bg-gray-200'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                        isLocked ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              )
            })}
          </div>
          {lockError && (
            <p className="text-sm text-red-600 mt-4" role="alert">
              {lockError}
            </p>
          )}
        </Card>

        {deleteError && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {deleteError}
          </p>
        )}

        <div className="space-y-8">
          <div>
            <h3 className="font-serif text-lg font-semibold text-dark-blue mb-3">
              Gästebuch ({guestbookEntries.length})
            </h3>
            <div className="space-y-3">
              {guestbookEntries.map((entry) => (
                <Card key={entry.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-dark-blue text-sm">{entry.name}</p>
                        <p className="text-xs text-gray-400">{formatDate(entry.createdAt)}</p>
                      </div>
                      <p className="text-sm text-gray-600">{entry.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteGuestbookEntry(entry.id)}
                      aria-label={`Löschen: Eintrag von ${entry.name}`}
                      className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-serif text-lg font-semibold text-dark-blue mb-3">
              Erinnerungen ({memoryEntries.length})
            </h3>
            <div className="space-y-3">
              {memoryEntries.map((entry) => (
                <Card key={entry.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-dark-blue text-sm">{entry.name}</p>
                        <p className="text-xs text-gray-400">{formatDate(entry.createdAt)}</p>
                      </div>
                      <p className="text-sm text-gray-600">{entry.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteMemoryEntry(entry.id)}
                      aria-label={`Löschen: Eintrag von ${entry.name}`}
                      className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/admin/AdminDashboard.test.tsx`
Expected: PASS (6/6)

- [ ] **Step 5: Test für die `/admin`-Seite anpassen**

```tsx
// src/app/admin/page.test.tsx (vollständige neue Fassung)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AdminPage from './page'

vi.mock('@/components/admin/AdminLoginForm', () => ({
  default: ({ onSuccess }: { onSuccess: () => void }) => (
    <button onClick={onSuccess}>stub-login-success</button>
  ),
}))
vi.mock('@/components/admin/AdminDashboard', () => ({
  default: ({ initialLocks }: { initialLocks: { guestbook: boolean } }) => (
    <div data-testid="dashboard-stub">{String(initialLocks.guestbook)}</div>
  ),
}))

const noLocks = { guestbook: false, memories: false, who_votes: false }

describe('AdminPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the login form when the admin check fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    render(<AdminPage />)
    await waitFor(() => expect(screen.getByText('stub-login-success')).toBeInTheDocument())
  })

  it('shows the dashboard with the fetched lock status when already authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ locks: { ...noLocks, guestbook: true } }),
      })
    )
    render(<AdminPage />)
    await waitFor(() => expect(screen.getByTestId('dashboard-stub')).toHaveTextContent('true'))
  })

  it('switches from login to dashboard after a successful login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    render(<AdminPage />)
    const loginButton = await screen.findByText('stub-login-success')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ locks: noLocks }) })
    )
    loginButton.click()

    await waitFor(() => expect(screen.getByTestId('dashboard-stub')).toBeInTheDocument())
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/admin/page.test.tsx`
Expected: FAIL — Seite liest noch `data.locked` statt `data.locks`,
übergibt noch `initialLocked` statt `initialLocks`

- [ ] **Step 7: `/admin`-Seite anpassen**

```tsx
// src/app/admin/page.tsx (vollständige neue Fassung)
'use client'

import { useEffect, useState } from 'react'
import AdminLoginForm from '@/components/admin/AdminLoginForm'
import AdminDashboard from '@/components/admin/AdminDashboard'

interface Locks {
  guestbook: boolean
  memories: boolean
  who_votes: boolean
}

type AuthState =
  | { status: 'checking' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; locks: Locks }

async function checkAuth(): Promise<AuthState> {
  try {
    const response = await fetch('/api/admin/write-lock')
    if (!response.ok) {
      return { status: 'unauthenticated' }
    }
    const data = (await response.json()) as { locks: Locks }
    return { status: 'authenticated', locks: data.locks }
  } catch {
    return { status: 'unauthenticated' }
  }
}

export default function AdminPage() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' })

  useEffect(() => {
    checkAuth().then(setAuth)
  }, [])

  if (auth.status === 'checking') {
    // Bewusst leer statt eines Ladespinners: verhindert, dass zwischen
    // Server- und erstem Client-Render unterschiedliche Inhalte
    // gerendert werden (siehe Hydration-Lehre aus dem Memory-Spiel-Review).
    return null
  }

  if (auth.status === 'unauthenticated') {
    return <AdminLoginForm onSuccess={() => checkAuth().then(setAuth)} />
  }

  return <AdminDashboard initialLocks={auth.locks} />
}
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/admin/page.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 9: Gesamte Toolchain inklusive Build prüfen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün.

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/AdminDashboard.tsx src/components/admin/AdminDashboard.test.tsx \
  src/app/admin/page.tsx src/app/admin/page.test.tsx
git commit -m "Show three independent write-lock switches in the admin dashboard"
```

---

## Abschluss

Nach Task 3 lassen sich Gästebuch, Erinnerungen und die
Wer-von-uns-Abstimmung unabhängig voneinander sperren, jede mit eigenem
Schalter im Dashboard. Die alte gemeinsame `writes_locked`-Spalte in
`app_config` bleibt als verwaister, ungenutzter Eintrag bestehen (SQLite
hat kein `DROP COLUMN`-Äquivalent, das hier nötig wäre, da `app_config`
ein Key-Value-Schema ist - der alte Key `writes_locked` wird einfach nie
wieder gelesen oder geschrieben, kein Aufräumschritt nötig).
