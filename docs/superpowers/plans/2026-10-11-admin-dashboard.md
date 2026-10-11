# Admin-Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine `/admin`-Seite (Login + Dashboard in einem), über die das
Brautpaar Gästebuch-/Erinnerungs-Einträge löschen und eine
Schreib-Sperre als Notfall-Schalter umlegen kann.

**Architecture:** `/admin` ist eine Client-Komponente, die beim Laden den
bestehenden `admin_session`-Cookie über einen neuen, admin-geschützten
Endpunkt prüft (`GET /api/admin/write-lock` dient doppelt: Lock-Status
UND Auth-Check in einem Request) und je nach Ergebnis Login-Formular oder
Dashboard zeigt - kein Server-Component-`cookies()`-Pfad, damit der
gesamte Admin-Bereich demselben, bereits bewährten
Client-Component+fetch-Testmuster folgt wie jede andere Seite in dieser
App. Das Dashboard nutzt für die Einträge die bereits bestehenden
öffentlichen `GET /api/guestbook`/`GET /api/memories` und die bereits
bestehenden admin-geschützten `DELETE`-Routen (beide aus dem
Gästebuch/Erinnerungen-Plan) - keine neuen Lese-/Lösch-Endpunkte nötig.

**Tech Stack:** Next.js App Router · React 19 · Tailwind v4 (Theme aus dem
Design-System-Plan) · better-sqlite3 (bereits vorhandenes Schema) · Zod ·
lucide-react · Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-11-rewrite-design.md`

## Global Constraints

- **Galerie-Modus-Schalter ist NICHT Teil dieses Plans.** Die Spec listet
  ihn unter "Admin", aber die Galerie selbst existiert noch nicht
  (blockiert auf fehlende R2-Zugangsdaten, siehe `TODO.md`). Das
  Dashboard zeigt in diesem Plan nur Gästebuch, Erinnerungen und die
  Schreib-Sperre - der Galerie-Teil kommt mit dem Galerie-Plan dazu,
  ohne dass sich an diesem Plan etwas ändern muss.
- Die Schreib-Sperre (`app_config`-Key `writes_locked`) blockiert laut
  Spec ausdrücklich nur **neue** Gästebuch-/Erinnerungs-Einträge - nicht
  das Lesen bestehender Einträge und nicht das Löschen durch den Admin
  (gerade während eines Notfalls muss Moderation weiter möglich sein).
- Kein Link zu `/admin` in Navigation/Footer (Spec, bereits erfüllt -
  `navigationItems` wird in diesem Plan nicht angefasst). `/admin` ist
  nur über die direkte URL erreichbar.
- `isAdminRequest` (Gästebuch/Erinnerungen-Plan) ist die einzige
  Auth-Prüfung für alles Admin-geschützte in diesem Plan - keine zweite,
  abweichende Prüfung.
- TDD ist Pflicht für jede Funktion/Komponente mit eigener Logik.

## Review Focus

- Die Schreib-Sperre darf, wenn aktiv, ausschließlich neue POSTs
  blockieren - GET (Lesen) und DELETE (Admin-Moderation) müssen auch bei
  aktiver Sperre weiter funktionieren.
- Das Dashboard darf Einträge oder Lösch-Buttons niemals zeigen, bevor
  die Admin-Prüfung erfolgreich war - kein kurzes Aufblitzen geschützter
  Inhalte vor der Auth-Antwort.
- Ein Lösch-Klick im Dashboard darf den Eintrag erst aus der Liste
  entfernen, nachdem der Server die Löschung bestätigt hat - nicht
  optimistisch vorher (gleiche Fehlerklasse wie der verlorene
  Stimmabgabe-Bug aus dem Quiz-Review).
- Das Umlegen der Schreib-Sperre muss serverseitig persistiert werden -
  ein zweiter GET-Request muss den neuen Zustand zeigen, nicht nur
  clientseitig geänderten State.
- Ein Gast, der versucht zu posten während die Sperre aktiv ist, muss
  eine verständliche deutsche Fehlermeldung im Formular sehen, keinen
  rohen Fehlertext oder ein stilles Nichts-Passiert.

---

## Task 1: Schreib-Sperre — Primitive & Durchsetzung

**Files:**
- Create: `src/lib/app-config.ts`
- Test: `src/lib/app-config.test.ts`
- Modify: `src/app/api/guestbook/route.ts`
- Test: `src/app/api/guestbook/route.test.ts` (ergänzen)
- Modify: `src/app/api/memories/route.ts`
- Test: `src/app/api/memories/route.test.ts` (ergänzen)

**Interfaces:**
- Produces: `isWritesLocked(db): boolean`,
  `setWritesLocked(db, locked: boolean): void`. Von Task 2 (Admin-API)
  und von diesem Task's eigenen POST-Routen konsumiert.

- [ ] **Step 1: Test für die Zugriffsschicht schreiben**

```ts
// src/lib/app-config.test.ts
import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { isWritesLocked, setWritesLocked } from './app-config'

describe('app-config writes lock', () => {
  it('defaults to unlocked when no config row exists yet', () => {
    const db = createDb(':memory:')
    expect(isWritesLocked(db)).toBe(false)
    db.close()
  })

  it('locks and unlocks, persisting across calls', () => {
    const db = createDb(':memory:')
    setWritesLocked(db, true)
    expect(isWritesLocked(db)).toBe(true)

    setWritesLocked(db, false)
    expect(isWritesLocked(db)).toBe(false)
    db.close()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/app-config.test.ts`
Expected: FAIL — `Cannot find module './app-config'`

- [ ] **Step 3: Zugriffsschicht implementieren**

```ts
// src/lib/app-config.ts
import type Database from 'better-sqlite3'

const WRITES_LOCKED_KEY = 'writes_locked'

export function isWritesLocked(db: Database.Database): boolean {
  const row = db
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .get(WRITES_LOCKED_KEY) as { value: string } | undefined
  return row?.value === 'true'
}

export function setWritesLocked(db: Database.Database, locked: boolean): void {
  db.prepare(
    'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(WRITES_LOCKED_KEY, locked ? 'true' : 'false')
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/app-config.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Tests für die Durchsetzung in Gästebuch/Erinnerungen
  schreiben**

```ts
// Ergänzung in src/app/api/guestbook/route.test.ts
import { setWritesLocked } from '@/lib/app-config'
import { getDb } from '@/lib/db'

it('rejects a new entry with 423 while writes are locked, but GET still works', async () => {
  setWritesLocked(getDb(), true)

  const response = await POST(
    postRequest({ name: 'Anna', message: 'Eine Nachricht während der Sperre.' })
  )
  expect(response.status).toBe(423)

  const getResponse = await GET()
  expect(getResponse.status).toBe(200)
})

it('accepts a new entry again once writes are unlocked', async () => {
  setWritesLocked(getDb(), true)
  setWritesLocked(getDb(), false)

  const response = await POST(
    postRequest({ name: 'Anna', message: 'Eine Nachricht nach dem Entsperren.' })
  )
  expect(response.status).toBe(201)
})
```

```ts
// Ergänzung in src/app/api/memories/route.test.ts
import { setWritesLocked } from '@/lib/app-config'
import { getDb } from '@/lib/db'

it('rejects a new entry with 423 while writes are locked, but GET still works', async () => {
  setWritesLocked(getDb(), true)

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
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/guestbook/route.test.ts src/app/api/memories/route.test.ts`
Expected: FAIL — die drei neuen Tests erwarten Status 423/201, Routen
kennen die Sperre noch nicht (immer 201/400)

- [ ] **Step 7: Durchsetzung in beiden POST-Routen ergänzen**

```ts
// src/app/api/guestbook/route.ts - Import ergänzen und POST anpassen
import { isWritesLocked } from '@/lib/app-config'

// ... im POST-Handler, direkt nach dem Rate-Limit-Check, vor dem Body-Parsing:
  if (isWritesLocked(getDb())) {
    return NextResponse.json(
      { error: 'Neue Einträge sind derzeit vorübergehend gesperrt.' },
      { status: 423 }
    )
  }
```

```ts
// src/app/api/memories/route.ts - Import ergänzen und POST anpassen
import { isWritesLocked } from '@/lib/app-config'

// ... im POST-Handler, direkt nach dem Rate-Limit-Check, vor der
// Kennwort-Prüfung (die Sperre gilt unabhängig vom Kennwort):
  if (isWritesLocked(getDb())) {
    return NextResponse.json(
      { error: 'Neue Einträge sind derzeit vorübergehend gesperrt.' },
      { status: 423 }
    )
  }
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/guestbook/route.test.ts src/app/api/memories/route.test.ts`
Expected: PASS (7/7 und 7/7)

- [ ] **Step 9: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 10: Commit**

```bash
git add src/lib/app-config.ts src/lib/app-config.test.ts \
  src/app/api/guestbook/route.ts src/app/api/guestbook/route.test.ts \
  src/app/api/memories/route.ts src/app/api/memories/route.test.ts
git commit -m "Add writes-locked emergency switch, enforced in guestbook/memories POST"
```

---

## Task 2: Admin-API für die Schreib-Sperre

**Files:**
- Create: `src/app/api/admin/write-lock/route.ts`
- Test: `src/app/api/admin/write-lock/route.test.ts`

**Interfaces:**
- Consumes: `isAdminRequest` (`admin-auth.ts`), `isWritesLocked`,
  `setWritesLocked` (Task 1).
- Produces: `GET /api/admin/write-lock` → `{ locked: boolean }`,
  `POST /api/admin/write-lock` (Body `{ locked: boolean }`) → `{ locked: boolean }`.
  Dient im Dashboard (Task 3) zugleich als Auth-Check UND
  Lock-Status-Abfrage in einem Request.

- [ ] **Step 1: Test schreiben**

```ts
// src/app/api/admin/write-lock/route.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'
import { getDb } from '@/lib/db'
import { getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'
import { ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

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

  it('GET returns the current lock status (false by default) for an admin', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await GET(requestWithCookie('GET', cookieValue))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.locked).toBe(false)
  })

  it('POST rejects a request without a valid admin cookie', async () => {
    const response = await POST(requestWithCookie('POST', undefined, { locked: true }))
    expect(response.status).toBe(401)
  })

  it('POST updates the lock, and a subsequent GET reflects it', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const postResponse = await POST(requestWithCookie('POST', cookieValue, { locked: true }))
    expect(postResponse.status).toBe(200)

    const getResponse = await GET(requestWithCookie('GET', cookieValue))
    const body = await getResponse.json()
    expect(body.locked).toBe(true)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/admin/write-lock/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Route implementieren**

```ts
// src/app/api/admin/write-lock/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { isWritesLocked, setWritesLocked } from '@/lib/app-config'

const bodySchema = z.object({ locked: z.boolean() })

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }
  return NextResponse.json({ locked: isWritesLocked(db) })
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

  setWritesLocked(db, parsed.data.locked)
  return NextResponse.json({ locked: parsed.data.locked })
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/admin/write-lock/route.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/write-lock/route.ts src/app/api/admin/write-lock/route.test.ts
git commit -m "Add admin write-lock status/toggle API route"
```

---

## Task 3: Admin-Login & Dashboard-Seite

**Files:**
- Create: `src/components/admin/AdminLoginForm.tsx`
- Test: `src/components/admin/AdminLoginForm.test.tsx`
- Create: `src/components/admin/AdminDashboard.tsx`
- Test: `src/components/admin/AdminDashboard.test.tsx`
- Create: `src/app/admin/page.tsx`
- Test: `src/app/admin/page.test.tsx`

**Interfaces:**
- Consumes: `SectionTitle`, `Card`, `Button`, `cn`,
  `POST /api/admin/login`, `POST /api/admin/logout` (bereits
  bestehend), `GET/POST /api/admin/write-lock` (Task 2),
  `GET /api/guestbook`, `DELETE /api/guestbook/[id]`,
  `GET /api/memories`, `DELETE /api/memories/[id]` (bereits bestehend).

- [ ] **Step 1: Test für `AdminLoginForm` schreiben**

```tsx
// src/components/admin/AdminLoginForm.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminLoginForm from './AdminLoginForm'

describe('AdminLoginForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('submits the password and calls onSuccess when the server accepts it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const onSuccess = vi.fn()

    render(<AdminLoginForm onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText(/Passwort/i), 'geheim123')
    await userEvent.click(screen.getByRole('button', { name: /anmelden/i }))

    expect(onSuccess).toHaveBeenCalled()
  })

  it('shows an error and does not call onSuccess when the password is wrong', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Falsches Passwort.' }) })
    )
    const onSuccess = vi.fn()

    render(<AdminLoginForm onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText(/Passwort/i), 'falsch')
    await userEvent.click(screen.getByRole('button', { name: /anmelden/i }))

    expect(await screen.findByText('Falsches Passwort.')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/admin/AdminLoginForm.test.tsx`
Expected: FAIL — `Cannot find module './AdminLoginForm'`

- [ ] **Step 3: `AdminLoginForm` implementieren**

```tsx
// src/components/admin/AdminLoginForm.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { KeyRound, Lock } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'

interface AdminLoginFormProps {
  onSuccess: () => void
}

export default function AdminLoginForm({ onSuccess }: AdminLoginFormProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error ?? 'Anmeldung fehlgeschlagen.')
        return
      }
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pt-24 pb-16 flex items-center">
      <div className="max-w-sm mx-auto px-4 sm:px-6 w-full">
        <SectionTitle title="Admin-Bereich" subtitle="Bitte mit dem Admin-Passwort anmelden." />

        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="w-12 h-12 bg-champagne rounded-xl flex items-center justify-center mx-auto">
              <Lock size={20} className="text-dark-blue" />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                <KeyRound size={14} className="inline mr-1" />
                Passwort
              </label>
              <input
                id="admin-password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" size="lg" disabled={submitting || password.length === 0} className="w-full">
              {submitting ? 'Wird geprüft...' : 'Anmelden'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/admin/AdminLoginForm.test.tsx`
Expected: PASS (2/2)

- [ ] **Step 5: Test für `AdminDashboard` schreiben**

```tsx
// src/components/admin/AdminDashboard.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminDashboard from './AdminDashboard'

function mockFetchSequence(responses: { status?: number; body: unknown }[]) {
  const fn = vi.fn()
  responses.forEach(({ status = 200, body }) => {
    fn.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('AdminDashboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and shows guestbook and memories entries', async () => {
    mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [{ id: 5, name: 'Ben', message: 'Schöne Erinnerung an euch.', photoKey: null, createdAt: '2026-10-11T11:00:00.000Z' }] } },
    ])

    render(<AdminDashboard initialLocked={false} />)

    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())
    expect(screen.getByText(/Schöne Erinnerung an euch\./)).toBeInTheDocument()
  })

  it('removes an entry from the list only after the server confirms deletion', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [] } },
      { status: 200, body: { success: true } },
    ])

    render(<AdminDashboard initialLocked={false} />)
    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*Anna/i }))

    await waitFor(() => expect(screen.queryByText('Herzlichen Glückwunsch euch!')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/guestbook/1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('does not remove the entry if the server delete fails', async () => {
    mockFetchSequence([
      { body: { entries: [{ id: 1, name: 'Anna', message: 'Herzlichen Glückwunsch euch!', createdAt: '2026-10-11T10:00:00.000Z' }] } },
      { body: { entries: [] } },
      { status: 500, body: { error: 'Serverfehler' } },
    ])

    render(<AdminDashboard initialLocked={false} />)
    await waitFor(() => expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /löschen.*Anna/i }))

    await waitFor(() => expect(screen.getByText(/löschen fehlgeschlagen/i)).toBeInTheDocument())
    expect(screen.getByText('Herzlichen Glückwunsch euch!')).toBeInTheDocument()
  })

  it('toggles the write lock and persists it to the server', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { body: { entries: [] } },
      { body: { locked: true } },
    ])

    render(<AdminDashboard initialLocked={false} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    await userEvent.click(screen.getByRole('switch', { name: /schreib-sperre/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/write-lock',
        expect.objectContaining({ method: 'POST' })
      )
    )
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/admin/AdminDashboard.test.tsx`
Expected: FAIL — `Cannot find module './AdminDashboard'`

- [ ] **Step 7: `AdminDashboard` implementieren**

```tsx
// src/components/admin/AdminDashboard.tsx
'use client'

import { useEffect, useState } from 'react'
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

interface AdminDashboardProps {
  initialLocked: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminDashboard({ initialLocked }: AdminDashboardProps) {
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([])
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([])
  const [locked, setLocked] = useState(initialLocked)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  const toggleLock = async () => {
    const next = !locked
    try {
      const response = await fetch('/api/admin/write-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: next }),
      })
      if (!response.ok) return
      const data = (await response.json()) as { locked: boolean }
      setLocked(data.locked)
    } catch {
      // Zustand bleibt unverändert, wenn das Umschalten fehlschlägt.
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-start justify-between gap-4 mb-8">
          <SectionTitle title="Admin" subtitle="Einträge moderieren, Schreib-Sperre umschalten." centered={false} />
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
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert size={20} className={locked ? 'text-red-600' : 'text-gray-400'} />
              <div>
                <p className="font-semibold text-dark-blue text-sm">Schreib-Sperre</p>
                <p className="text-xs text-gray-400">
                  {locked ? 'Neue Einträge sind gesperrt.' : 'Neue Einträge sind erlaubt.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={locked}
              aria-label="Schreib-Sperre"
              onClick={toggleLock}
              className={cn(
                'w-12 h-7 rounded-full transition-colors relative flex-shrink-0',
                locked ? 'bg-red-500' : 'bg-gray-200'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                  locked ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
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

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/admin/AdminDashboard.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 9: Test für die `/admin`-Seite schreiben**

```tsx
// src/app/admin/page.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AdminPage from './page'

vi.mock('@/components/admin/AdminLoginForm', () => ({
  default: ({ onSuccess }: { onSuccess: () => void }) => (
    <button onClick={onSuccess}>stub-login-success</button>
  ),
}))
vi.mock('@/components/admin/AdminDashboard', () => ({
  default: ({ initialLocked }: { initialLocked: boolean }) => (
    <div data-testid="dashboard-stub">{String(initialLocked)}</div>
  ),
}))

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
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ locked: true }) })
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
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ locked: false }) })
    )
    loginButton.click()

    await waitFor(() => expect(screen.getByTestId('dashboard-stub')).toBeInTheDocument())
  })
})
```

- [ ] **Step 10: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/admin/page.test.tsx`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 11: Seite implementieren**

```tsx
// src/app/admin/page.tsx
'use client'

import { useEffect, useState } from 'react'
import AdminLoginForm from '@/components/admin/AdminLoginForm'
import AdminDashboard from '@/components/admin/AdminDashboard'

type AuthState =
  | { status: 'checking' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; locked: boolean }

async function checkAuth(): Promise<AuthState> {
  try {
    const response = await fetch('/api/admin/write-lock')
    if (!response.ok) {
      return { status: 'unauthenticated' }
    }
    const data = (await response.json()) as { locked: boolean }
    return { status: 'authenticated', locked: data.locked }
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

  return <AdminDashboard initialLocked={auth.locked} />
}
```

- [ ] **Step 12: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/admin/page.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 13: Gesamte Toolchain inklusive Build prüfen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün.

- [ ] **Step 14: Commit**

```bash
git add src/components/admin/AdminLoginForm.tsx src/components/admin/AdminLoginForm.test.tsx \
  src/components/admin/AdminDashboard.tsx src/components/admin/AdminDashboard.test.tsx \
  src/app/admin/page.tsx src/app/admin/page.test.tsx
git commit -m "Add admin login and dashboard page"
```

---

## Abschluss

Nach Task 3 kann das Brautpaar über `/admin` (nur per direkter URL,
nicht verlinkt) Gästebuch-/Erinnerungs-Einträge löschen und im Notfall
neue Einträge sperren. Der Galerie-Teil des Dashboards (Modus-Schalter,
Galerie-Lösch-Liste) kommt mit dem Galerie-Plan dazu, sobald die
R2-Zugangsdaten vorliegen (`TODO.md`) - dieser Plan ist bewusst so
geschnitten, dass das keine Änderung an den hier gebauten Teilen
braucht, nur eine Ergänzung.
