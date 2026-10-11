# Gästebuch & Erinnerungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die `/guestbook`-Seite (offenes Freitext-Gästebuch) und die
`/memories`-Seite (Erinnerungen: Text + optional Foto, Upload-Kennwort
nötig), beide mit Admin-Löschfunktion über die bestehende Admin-Session.

**Architecture:** Beide Features sind serverseitig über die bereits
bestehenden SQLite-Tabellen `guestbook_entries` und `memories_entries`
(Foundation-Plan, `src/lib/db.ts`) persistiert - kein localStorage-Mock
wie in der alten App. Jedes Feature bekommt eine schlanke
Datenzugriffsschicht, eine REST-ähnliche API-Route (GET/POST) und eine
admin-geschützte Lösch-Route. Eine gemeinsame `isAdminRequest`-Hilfsfunktion
(neu, Task 1) prüft das bestehende `admin_session`-Cookie für beide
Lösch-Routen - kein eigenes Admin-UI in diesem Plan (eigener späterer
Plan für das Dashboard).

**Tech Stack:** Next.js App Router · React 19 · Tailwind v4 (Theme aus dem
Design-System-Plan) · better-sqlite3 (bereits vorhandenes Schema) · Zod ·
lucide-react · Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-11-rewrite-design.md`

## Global Constraints

- `guestbook_entries` und `memories_entries` existieren bereits
  (Foundation-Plan) - dieser Plan fügt nur Zugriffsschicht, API-Routen
  und Seiten hinzu, keine Schema-Änderung.
- **Gästebuch ist offen, kein Kennwort** (Spec). Nachricht: mind. 10,
  max. 500 Zeichen - serverseitig per Zod geprüft, nicht nur im Formular
  (ein direkter API-Call umginge sonst die Client-Validierung).
- **Erinnerungen brauchen ein Kennwort** (`UPLOAD_PASSWORD_EMPFANG`,
  Spec: "Upload-Kennwort nötig"). Dieser Plan ergänzt die fehlende
  Pflicht-Umgebungsvariable in `src/lib/env.ts` (bisher nur
  `ADMIN_PASSWORD` geprüft) und prüft das Kennwort serverseitig
  timing-safe über die bereits bestehende `verifyPassword`-Funktion
  (`admin-auth.ts`) - dieselbe Funktion, kein Duplikat.
- **Foto-Upload für Erinnerungen ist NICHT Teil dieses Plans.** Die
  R2-Foto-Pipeline (Spec-Abschnitt "R2-Foto-Pipeline") ist noch nicht
  gebaut und blockiert auf Cloudflare-R2-Zugangsdaten vom Nutzer (siehe
  `TODO.md`). `photo_key` bleibt in diesem Plan immer `null`; das
  Formular zeigt keine Foto-Option. Die alte App hatte zusätzlich einen
  dritten Typ "Video" - der ist laut Spec ohnehin explizit auf nach der
  Hochzeit verschoben und wird hier nicht nachgebaut.
- Rate-Limiting vor beiden POST-Routen (Spec: "... vor Login,
  Upload-Request, Gästebuch, Erinnerungen"), gleiche Form wie der
  bestehende Login-Limiter: 5 Versuche/15 Min pro IP (`RateLimiter` aus
  `src/lib/rate-limit.ts`, `getClientKey` aus `src/lib/client-ip.ts` -
  beide bereits vorhanden, direkt wiederverwendet).
- Admin-Löschung: beide DELETE-Routen prüfen das bestehende
  `admin_session`-Cookie (gleiche HMAC-Prüfung wie der Login). Es gibt in
  diesem Plan keine Admin-Oberfläche, die diese Routen aufruft - das ist
  der nächste Plan.
- TDD ist Pflicht für jede Funktion/Komponente mit eigener Logik.

## Review Focus

- Eine Nachricht unterhalb der Mindestlänge (oder nur Leerzeichen) muss
  serverseitig abgelehnt werden, auch wenn ein Client die
  Formular-Validierung umgeht.
- Der Rate-Limiter für Gästebuch/Erinnerungen muss einen sechsten
  Versuch derselben IP innerhalb von 15 Minuten tatsächlich blockieren -
  nicht nur die ersten fünf durchlassen.
- Die Kennwort-Prüfung bei Erinnerungen muss ein falsches oder fehlendes
  Kennwort ablehnen, ohne zu verraten, ob Name/Nachricht ansonsten
  gültig gewesen wären, und zeitkonstant vergleichen (nicht `===`).
- Die admin-geschützten DELETE-Routen müssen eine Anfrage ohne Cookie,
  mit abgelaufenem Cookie und mit manipuliertem Cookie gleichermaßen
  ablehnen - nicht nur den Fall "kein Cookie".
- Das Löschen eines bereits gelöschten oder nie existierenden Eintrags
  darf keinen unbehandelten Fehler auslösen - eine saubere Antwort statt
  eines 500ers.

---

## Task 1: Admin-Request-Prüfung & Upload-Kennwort in env.ts

**Files:**
- Modify: `src/lib/admin-auth.ts`
- Test: `src/lib/admin-auth.test.ts` (ergänzen)
- Modify: `src/app/api/admin/login/route.ts`
- Modify: `src/app/api/admin/logout/route.ts`
- Modify: `src/lib/env.ts`
- Test: `src/lib/env.test.ts` (ergänzen)
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `isAdminRequest(request: Request, db: Database.Database): boolean`.
  Von Task 2 und Task 4s DELETE-Routen konsumiert.
- Produces: `AppEnv.uploadPasswordEmpfang: string` (validateEnv prüft
  jetzt zusätzlich `UPLOAD_PASSWORD_EMPFANG`). Von Task 4s POST-Route
  konsumiert (liest aber direkt `process.env.UPLOAD_PASSWORD_EMPFANG`,
  wie die bestehende Login-Route es mit `ADMIN_PASSWORD` tut - `env.ts`
  dient nur der Start-Validierung, nicht als Laufzeit-Zugriffspfad).
- Verschiebt: `ADMIN_COOKIE_NAME` von `login/route.ts` nach
  `admin-auth.ts` (siehe Step 0 unten) - `isAdminRequest` braucht diese
  Konstante, und `admin-auth.ts` kann nicht aus `login/route.ts`
  importieren, ohne einen Zirkel zu bauen (`login/route.ts` importiert
  bereits `getOrCreateAdminSecret`/`signCookieValue`/`verifyPassword`
  aus `admin-auth.ts`). `admin-auth.ts` ist ohnehin der richtige Ort -
  dort steht schon `ADMIN_SESSION_DURATION_MS`.

`login/route.ts` definiert aktuell `export const ADMIN_COOKIE_NAME =
'admin_session'`, und `logout/route.ts` importiert sie von dort. Das
zuerst auflösen, bevor `isAdminRequest` entsteht:

- [ ] **Step 0a: `ADMIN_COOKIE_NAME` nach `admin-auth.ts` verschieben**

```ts
// src/lib/admin-auth.ts - ganz oben, direkt nach den Imports ergänzen
export const ADMIN_COOKIE_NAME = 'admin_session'
```

```ts
// src/app/api/admin/login/route.ts - Import-Block ersetzen
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_DURATION_MS,
  getOrCreateAdminSecret,
  signCookieValue,
  verifyPassword,
} from '@/lib/admin-auth'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'

const loginSchema = z.object({ password: z.string().min(1) })
```

Die eigene `export const ADMIN_COOKIE_NAME = 'admin_session'`-Zeile in
`login/route.ts` entfernen (steht jetzt in `admin-auth.ts`). Der Rest der
Datei (Rate-Limiter, `POST`-Handler) bleibt unverändert.

```ts
// src/app/api/admin/logout/route.ts - vollständige neue Fassung
import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(ADMIN_COOKIE_NAME)
  return response
}
```

- [ ] **Step 0b: Bestehende Login/Logout-Tests laufen lassen, grün
  bestätigen (reine Verschiebung, kein Verhaltenswechsel)**

Run: `npx vitest run src/app/api/admin`
Expected: PASS (alle bestehenden Login/Logout-Tests unverändert grün)

- [ ] **Step 1: Test für `isAdminRequest` schreiben**

Zuerst den bestehenden Import-Block am Dateianfang erweitern - `createDb`
ist schon importiert, `ADMIN_COOKIE_NAME` und `isAdminRequest` fehlen
noch:

```ts
// src/lib/admin-auth.test.ts - bestehenden Import-Block ersetzen
import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import {
  ADMIN_COOKIE_NAME,
  getOrCreateAdminSecret,
  hashPassword,
  isAdminRequest,
  signCookieValue,
  verifyCookieValue,
  verifyPassword,
} from './admin-auth'
```

Dann am Dateiende anfügen:

```ts
describe('isAdminRequest', () => {
  function requestWithCookie(value?: string): Request {
    const headers = new Headers()
    if (value !== undefined) {
      headers.set('cookie', `${ADMIN_COOKIE_NAME}=${value}`)
    }
    return new Request('http://localhost/api/guestbook/1', { headers })
  }

  it('accepts a request with a valid, unexpired admin cookie', () => {
    const db = createDb(':memory:')
    const secret = getOrCreateAdminSecret(db)
    const expiresAt = Date.now() + 1000
    const value = signCookieValue(expiresAt, secret)

    expect(isAdminRequest(requestWithCookie(value), db)).toBe(true)
    db.close()
  })

  it('rejects a request with no cookie at all', () => {
    const db = createDb(':memory:')
    getOrCreateAdminSecret(db)
    expect(isAdminRequest(requestWithCookie(undefined), db)).toBe(false)
    db.close()
  })

  it('rejects a request with an expired cookie', () => {
    const db = createDb(':memory:')
    const secret = getOrCreateAdminSecret(db)
    const expiresAt = Date.now() - 1000
    const value = signCookieValue(expiresAt, secret)

    expect(isAdminRequest(requestWithCookie(value), db)).toBe(false)
    db.close()
  })

  it('rejects a request with a tampered cookie', () => {
    const db = createDb(':memory:')
    const secret = getOrCreateAdminSecret(db)
    const expiresAt = Date.now() + 1000
    const value = signCookieValue(expiresAt, secret)
    const tampered = value.slice(0, -1) + (value.endsWith('0') ? '1' : '0')

    expect(isAdminRequest(requestWithCookie(tampered), db)).toBe(false)
    db.close()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/admin-auth.test.ts`
Expected: FAIL — `isAdminRequest is not defined` (bzw. Importfehler)

- [ ] **Step 3: `isAdminRequest` implementieren**

```ts
// Ergänzung in src/lib/admin-auth.ts (am Dateiende anfügen)
// ADMIN_COOKIE_NAME steht bereits weiter oben in dieser Datei (Step 0a) -
// kein Import nötig, direkt referenzierbar.

export function isAdminRequest(request: Request, db: Database.Database): boolean {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return false

  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`))
  if (!match) return false

  const value = match.slice(ADMIN_COOKIE_NAME.length + 1)
  const secret = getOrCreateAdminSecret(db)
  return verifyCookieValue(value, secret)
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/admin-auth.test.ts`
Expected: PASS (alle bisherigen Tests plus die 4 neuen)

- [ ] **Step 5: `env.test.ts` auf die neue Pflichtvariable umschreiben**

Zwei bestehende Tests nehmen aktuell an, dass `ADMIN_PASSWORD` allein
reicht - das stimmt nach diesem Task nicht mehr. Die ganze Datei durch
diese Fassung ersetzen (bestehende zwei Tests angepasst, zwei neue
ergänzt):

```ts
// src/lib/env.test.ts (vollständige neue Fassung)
import { describe, expect, it } from 'vitest'
import { MissingEnvError, validateEnv } from './env'

describe('validateEnv', () => {
  it('returns the parsed env when both required variables are set', () => {
    const result = validateEnv({
      ADMIN_PASSWORD: 'secret',
      UPLOAD_PASSWORD_EMPFANG: 'empfang-secret',
    })
    expect(result.adminPassword).toBe('secret')
    expect(result.uploadPasswordEmpfang).toBe('empfang-secret')
  })

  it('throws MissingEnvError listing every missing key', () => {
    expect(() => validateEnv({})).toThrowError(MissingEnvError)
    try {
      validateEnv({})
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError)
      expect((error as MissingEnvError).missing).toEqual([
        'ADMIN_PASSWORD',
        'UPLOAD_PASSWORD_EMPFANG',
      ])
    }
  })

  it('requires UPLOAD_PASSWORD_EMPFANG even when ADMIN_PASSWORD is set', () => {
    expect(() => validateEnv({ ADMIN_PASSWORD: 'secret' })).toThrow(
      /UPLOAD_PASSWORD_EMPFANG/
    )
  })

  it('requires ADMIN_PASSWORD even when UPLOAD_PASSWORD_EMPFANG is set', () => {
    expect(() => validateEnv({ UPLOAD_PASSWORD_EMPFANG: 'empfang-secret' })).toThrow(
      /ADMIN_PASSWORD/
    )
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/env.test.ts`
Expected: FAIL — die beiden angepassten Tests erwarten
`uploadPasswordEmpfang`/die zweite fehlende Variable, die `env.ts` noch
nicht kennt

- [ ] **Step 7: `env.ts` erweitern**

```ts
// src/lib/env.ts (vollständige neue Fassung)
const REQUIRED_KEYS = ['ADMIN_PASSWORD', 'UPLOAD_PASSWORD_EMPFANG'] as const

export class MissingEnvError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(`Fehlende Pflicht-Umgebungsvariablen: ${missing.join(', ')}`)
    this.name = 'MissingEnvError'
    this.missing = missing
  }
}

export interface AppEnv {
  adminPassword: string
  uploadPasswordEmpfang: string
}

export function validateEnv(
  source: Record<string, string | undefined> = process.env
): AppEnv {
  const missing = REQUIRED_KEYS.filter((key) => !source[key])
  if (missing.length > 0) {
    throw new MissingEnvError(missing)
  }
  return {
    adminPassword: source.ADMIN_PASSWORD as string,
    uploadPasswordEmpfang: source.UPLOAD_PASSWORD_EMPFANG as string,
  }
}
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/env.test.ts`
Expected: PASS (4/4)

- [ ] **Step 9: Lokalen Build mit beiden Pflichtvariablen prüfen, dann
  die CI-Pipeline-Lücke beheben**

`instrumentation.ts`s `register()` ruft `validateEnv()` auf und beendet
den Prozess, wenn Pflichtvariablen fehlen - das passiert auch während
`next build` (server-seitiges Prerendering läuft in einem echten
Next.js-Prozess). `.github/workflows/ci.yml`s `Build`-Step setzt
**weder `ADMIN_PASSWORD` noch `UPLOAD_PASSWORD_EMPFANG`** - das war
schon vor diesem Plan so (`ADMIN_PASSWORD` ist seit dem Foundation-Plan
Pflicht) und ist nie aufgefallen, weil `develop` wegen der fehlenden
Push-Berechtigung (`TODO.md`) noch nie real in GitHub Actions gelaufen
ist. Da dieser Task ohnehin die Pflichtvariablen anfasst, wird das jetzt
mitbehoben, nicht erst beim nächsten Plan entdeckt.

Run: `ADMIN_PASSWORD=dev-build-only UPLOAD_PASSWORD_EMPFANG=dev-build-only npm run build`
Expected: Build erfolgreich (nur die bekannte, unveränderte
`process.exit`-Edge-Runtime-Warnung aus `instrumentation.ts`)

```yaml
# .github/workflows/ci.yml - im "build"-Job den "Build"-Step ersetzen
      - name: Build
        run: npm run build
        env:
          NEXT_TELEMETRY_DISABLED: '1'
          # Nur für den Build-Vorgang (Prerendering) nötig, kein echtes
          # Geheimnis - die echten Werte kommen zur Laufzeit aus der
          # Server-Umgebung (docker-compose/.env.production).
          ADMIN_PASSWORD: ci-build-only
          UPLOAD_PASSWORD_EMPFANG: ci-build-only
```

- [ ] **Step 10: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 11: Commit**

```bash
git add src/lib/admin-auth.ts src/lib/admin-auth.test.ts \
  src/app/api/admin/login/route.ts src/app/api/admin/logout/route.ts \
  src/lib/env.ts src/lib/env.test.ts .github/workflows/ci.yml
git commit -m "Add admin-request check, require UPLOAD_PASSWORD_EMPFANG, fix CI build env"
```

---

## Task 2: Gästebuch — Datenzugriff & API-Routen

**Files:**
- Create: `src/lib/guestbook.ts`
- Test: `src/lib/guestbook.test.ts`
- Create: `src/app/api/guestbook/route.ts`
- Test: `src/app/api/guestbook/route.test.ts`
- Create: `src/app/api/guestbook/[id]/route.ts`
- Test: `src/app/api/guestbook/[id]/route.test.ts`

**Interfaces:**
- Consumes: `getDb()` (`db.ts`), `RateLimiter` (`rate-limit.ts`),
  `getClientKey` (`client-ip.ts`), `isAdminRequest` (Task 1).
- Produces: `interface GuestbookEntry { id, name, message, createdAt }`,
  `addGuestbookEntry(db, name, message): GuestbookEntry`,
  `listGuestbookEntries(db): GuestbookEntry[]`,
  `deleteGuestbookEntry(db, id): boolean`. Nur von diesem Task's eigenen
  Routen konsumiert.

- [ ] **Step 1: Test für die Zugriffsschicht schreiben**

```ts
// src/lib/guestbook.test.ts
import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { addGuestbookEntry, deleteGuestbookEntry, listGuestbookEntries } from './guestbook'

describe('guestbook', () => {
  it('adds an entry and returns it with an id and createdAt', () => {
    const db = createDb(':memory:')
    const entry = addGuestbookEntry(db, 'Anna', 'Wir freuen uns so für euch!')

    expect(entry.id).toBeGreaterThan(0)
    expect(entry.name).toBe('Anna')
    expect(entry.message).toBe('Wir freuen uns so für euch!')
    expect(entry.createdAt).toEqual(expect.any(String))
    db.close()
  })

  it('lists entries newest first', () => {
    const db = createDb(':memory:')
    addGuestbookEntry(db, 'Anna', 'Erste Nachricht hier im Buch.')
    addGuestbookEntry(db, 'Ben', 'Zweite Nachricht, kurz danach.')

    const entries = listGuestbookEntries(db)
    expect(entries).toHaveLength(2)
    expect(entries[0].name).toBe('Ben')
    expect(entries[1].name).toBe('Anna')
    db.close()
  })

  it('deletes an entry by id and returns true', () => {
    const db = createDb(':memory:')
    const entry = addGuestbookEntry(db, 'Anna', 'Diese Nachricht wird gelöscht.')

    expect(deleteGuestbookEntry(db, entry.id)).toBe(true)
    expect(listGuestbookEntries(db)).toHaveLength(0)
    db.close()
  })

  it('returns false when deleting an id that does not exist', () => {
    const db = createDb(':memory:')
    expect(deleteGuestbookEntry(db, 999999)).toBe(false)
    db.close()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/guestbook.test.ts`
Expected: FAIL — `Cannot find module './guestbook'`

- [ ] **Step 3: Zugriffsschicht implementieren**

```ts
// src/lib/guestbook.ts
import type Database from 'better-sqlite3'

export interface GuestbookEntry {
  id: number
  name: string
  message: string
  createdAt: string
}

interface GuestbookRow {
  id: number
  name: string
  message: string
  created_at: string
}

function toEntry(row: GuestbookRow): GuestbookEntry {
  return { id: row.id, name: row.name, message: row.message, createdAt: row.created_at }
}

export function addGuestbookEntry(
  db: Database.Database,
  name: string,
  message: string
): GuestbookEntry {
  const result = db
    .prepare('INSERT INTO guestbook_entries (name, message) VALUES (?, ?)')
    .run(name, message)
  const row = db
    .prepare('SELECT id, name, message, created_at FROM guestbook_entries WHERE id = ?')
    .get(result.lastInsertRowid) as GuestbookRow
  return toEntry(row)
}

export function listGuestbookEntries(db: Database.Database): GuestbookEntry[] {
  const rows = db
    .prepare('SELECT id, name, message, created_at FROM guestbook_entries ORDER BY id DESC')
    .all() as GuestbookRow[]
  return rows.map(toEntry)
}

export function deleteGuestbookEntry(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM guestbook_entries WHERE id = ?').run(id)
  return result.changes > 0
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/guestbook.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: API-Routen-Tests schreiben**

```ts
// src/app/api/guestbook/route.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/guestbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/guestbook', () => {
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

  it('POST adds a valid entry and GET returns it', async () => {
    const postResponse = await POST(
      postRequest({ name: 'Anna', message: 'Wir freuen uns so sehr für euch beide!' })
    )
    expect(postResponse.status).toBe(201)

    const getResponse = await GET()
    const body = await getResponse.json()
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0].name).toBe('Anna')
  })

  it('POST rejects a message shorter than 10 characters', async () => {
    const response = await POST(postRequest({ name: 'Anna', message: 'Zu kurz' }))
    expect(response.status).toBe(400)

    const getResponse = await GET()
    const body = await getResponse.json()
    expect(body.entries).toHaveLength(0)
  })

  it('POST rejects a whitespace-only message', async () => {
    const response = await POST(postRequest({ name: 'Anna', message: '              ' }))
    expect(response.status).toBe(400)
  })

  it('POST rejects a missing name', async () => {
    const response = await POST(postRequest({ message: 'Eine ausreichend lange Nachricht.' }))
    expect(response.status).toBe(400)
  })
})
```

```ts
// src/app/api/guestbook/[id]/route.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DELETE } from './route'
import { addGuestbookEntry } from '@/lib/guestbook'
import { getDb } from '@/lib/db'
import { getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'
import { ADMIN_COOKIE_NAME } from '@/app/api/admin/login/route'

function deleteRequest(id: string, cookieValue?: string): Request {
  const headers = new Headers()
  if (cookieValue !== undefined) {
    headers.set('cookie', `${ADMIN_COOKIE_NAME}=${cookieValue}`)
  }
  return new Request(`http://localhost/api/guestbook/${id}`, { method: 'DELETE', headers })
}

describe('DELETE /api/guestbook/[id]', () => {
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

  it('deletes an entry when the request carries a valid admin cookie', async () => {
    const db = getDb()
    const entry = addGuestbookEntry(db, 'Anna', 'Eine Nachricht, die gelöscht werden soll.')
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await DELETE(deleteRequest(String(entry.id), cookieValue), {
      params: Promise.resolve({ id: String(entry.id) }),
    })
    expect(response.status).toBe(200)
  })

  it('rejects the request when there is no admin cookie', async () => {
    const db = getDb()
    const entry = addGuestbookEntry(db, 'Anna', 'Eine Nachricht, die bleiben soll.')

    const response = await DELETE(deleteRequest(String(entry.id)), {
      params: Promise.resolve({ id: String(entry.id) }),
    })
    expect(response.status).toBe(401)
  })

  it('returns 404 when deleting an id that does not exist, not a 500', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await DELETE(deleteRequest('999999', cookieValue), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/guestbook/route.test.ts src/app/api/guestbook/[id]/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (beide Dateien)

- [ ] **Step 7: API-Routen implementieren**

```ts
// src/app/api/guestbook/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { addGuestbookEntry, listGuestbookEntries } from '@/lib/guestbook'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'

const entrySchema = z.object({
  name: z.string().trim().min(1).max(60),
  message: z.string().trim().min(10).max(500),
})

const guestbookLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
})

export async function GET(): Promise<Response> {
  const entries = listGuestbookEntries(getDb())
  return NextResponse.json({ entries })
}

export async function POST(request: Request): Promise<Response> {
  const clientKey = getClientKey(request)
  const limit = guestbookLimiter.check(clientKey)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Einträge. Bitte später erneut versuchen.' },
      { status: 429 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = entrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const entry = addGuestbookEntry(getDb(), parsed.data.name, parsed.data.message)
  return NextResponse.json({ entry }, { status: 201 })
}
```

```ts
// src/app/api/guestbook/[id]/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { deleteGuestbookEntry } from '@/lib/guestbook'
import { isAdminRequest } from '@/lib/admin-auth'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 })
  }

  const deleted = deleteGuestbookEntry(db, numericId)
  if (!deleted) {
    return NextResponse.json({ error: 'Eintrag nicht gefunden.' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/guestbook/route.test.ts src/app/api/guestbook/[id]/route.test.ts`
Expected: PASS (4/4 und 3/3)

- [ ] **Step 9: Rate-Limit-Verhalten gezielt testen (Review Focus)**

```ts
// Ergänzung in src/app/api/guestbook/route.test.ts
it('blocks a sixth submission from the same IP within the window', async () => {
  const request = () =>
    new Request('http://localhost/api/guestbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
      body: JSON.stringify({ name: 'Anna', message: 'Eine gültige Nachricht hier drin.' }),
    })

  for (let i = 0; i < 5; i++) {
    const response = await POST(request())
    expect(response.status).toBe(201)
  }

  const sixth = await POST(request())
  expect(sixth.status).toBe(429)
})
```

- [ ] **Step 10: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/guestbook/route.test.ts`
Expected: PASS (5/5)

- [ ] **Step 11: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 12: Commit**

```bash
git add src/lib/guestbook.ts src/lib/guestbook.test.ts \
  src/app/api/guestbook/route.ts src/app/api/guestbook/route.test.ts \
  src/app/api/guestbook/\[id\]/route.ts src/app/api/guestbook/\[id\]/route.test.ts
git commit -m "Add guestbook data access layer and API routes"
```

---

## Task 3: Gästebuch-Seite

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Test: `src/components/ui/Button.test.tsx` (ergänzen)
- Create: `src/app/guestbook/page.tsx`
- Test: `src/app/guestbook/page.test.tsx`

**Interfaces:**
- Consumes: `SectionTitle`, `Card`, `Button` (vorherige Pläne), `cn`,
  `GET /api/guestbook`, `POST /api/guestbook` (Task 2, über `fetch`).
- Produces: `Button` bekommt eine neue optionale `type?: 'button' |
  'submit'`-Prop (Default weiterhin `'button'`, kein Verhaltensbruch für
  die bestehenden Aufrufer in `ClassicQuiz.tsx`/`MemoryGame.tsx`). Von
  diesem Task's Formular UND von Task 5s Formular konsumiert - Formulare
  brauchen einen echten `type="submit"`-Button, damit Enter im
  Textfeld und der native Submit-Pfad funktionieren, nicht nur ein
  Klick-Handler.

`Button.tsx` rendert `type="button"` fest verdrahtet - keine `type`-Prop
in der bisherigen `ButtonProps`. Ohne diese Erweiterung würde
`<Button type="submit">` in Schritt 3 unten gar nicht kompilieren
(`tsc`: `Property 'type' does not exist`). Das zuerst beheben:

- [ ] **Step 0a: Test für die `type`-Prop schreiben**

```tsx
// Ergänzung in src/components/ui/Button.test.tsx
it('renders as a submit button when type="submit" is passed', () => {
  render(<Button type="submit">Absenden</Button>)
  expect(screen.getByRole('button', { name: 'Absenden' })).toHaveAttribute('type', 'submit')
})

it('defaults to type="button" when no type is passed', () => {
  render(<Button>Weiter</Button>)
  expect(screen.getByRole('button', { name: 'Weiter' })).toHaveAttribute('type', 'button')
})
```

- [ ] **Step 0b: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/ui/Button.test.tsx`
Expected: FAIL — erster neuer Test erwartet `type="submit"`, bekommt
`type="button"` (fest verdrahtet)

- [ ] **Step 0c: `Button` um die `type`-Prop erweitern**

```tsx
// src/components/ui/Button.tsx (vollständige neue Fassung)
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

const variantClasses = {
  primary: 'bg-dark-blue text-white hover:bg-dark-blue-light shadow-md hover:shadow-lg',
  secondary: 'border-2 border-dark-blue text-dark-blue hover:bg-dark-blue hover:text-white',
}

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 0d: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/ui/Button.test.tsx`
Expected: PASS (4/4 - die 2 bestehenden plus die 2 neuen)

- [ ] **Step 0e: Gesamte Toolchain prüfen, dann committen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

```bash
git add src/components/ui/Button.tsx src/components/ui/Button.test.tsx
git commit -m "Add type prop to Button so it can submit a form"
```

- [ ] **Step 1: Test schreiben**

```tsx
// src/app/guestbook/page.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestbookPage from './page'

function mockFetchSequence(responses: unknown[]) {
  const fn = vi.fn()
  responses.forEach((body) => {
    fn.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('GuestbookPage', () => {
  beforeEach(() => {
    mockFetchSequence([{ entries: [] }])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and renders existing entries', async () => {
    mockFetchSequence([
      {
        entries: [
          { id: 1, name: 'Anna', message: 'Wir freuen uns so für euch!', createdAt: '2026-10-11T10:00:00.000Z' },
        ],
      },
    ])
    render(<GuestbookPage />)
    await waitFor(() => expect(screen.getByText('Wir freuen uns so für euch!')).toBeInTheDocument())
    expect(screen.getByText('Anna')).toBeInTheDocument()
  })

  it('submits a new entry and shows it in the list', async () => {
    const fetchMock = mockFetchSequence([
      { entries: [] },
      { entry: { id: 2, name: 'Ben', message: 'Alles Gute euch beiden zusammen!', createdAt: '2026-10-11T11:00:00.000Z' } },
    ])

    render(<GuestbookPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await userEvent.type(screen.getByLabelText(/Name/i), 'Ben')
    await userEvent.type(screen.getByLabelText(/Nachricht/i), 'Alles Gute euch beiden zusammen!')
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    await waitFor(() => expect(screen.getByText('Alles Gute euch beiden zusammen!')).toBeInTheDocument())
  })

  it('shows a validation message and does not submit when the message is too short', async () => {
    const fetchMock = mockFetchSequence([{ entries: [] }])
    render(<GuestbookPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await userEvent.type(screen.getByLabelText(/Name/i), 'Ben')
    await userEvent.type(screen.getByLabelText(/Nachricht/i), 'Zu kurz')
    await userEvent.click(screen.getByRole('button', { name: /eintragen/i }))

    expect(screen.getByText(/mindestens 10 Zeichen/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('carries its own top offset below the fixed navigation', async () => {
    const { container } = render(<GuestbookPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pt-24'))
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/guestbook/page.test.tsx`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: Seite implementieren**

```tsx
// src/app/guestbook/page.tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { MessageSquare, Send, User } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

interface GuestbookEntry {
  id: number
  name: string
  message: string
  createdAt: string
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function GuestbookPage() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([])
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/guestbook')
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data: { entries: GuestbookEntry[] }) => setEntries(data.entries))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedMessage = message.trim()
    if (!name.trim()) {
      setError('Bitte gib deinen Namen ein.')
      return
    }
    if (trimmedMessage.length < 10) {
      setError('Deine Nachricht ist zu kurz. Bitte schreib mindestens 10 Zeichen.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), message: trimmedMessage }),
      })
      if (!response.ok) {
        setError('Eintrag konnte nicht gespeichert werden. Bitte versuch es erneut.')
        return
      }
      const data = (await response.json()) as { entry: GuestbookEntry }
      setEntries((prev) => [data.entry, ...prev])
      setName('')
      setMessage('')
    } catch {
      setError('Eintrag konnte nicht gespeichert werden. Bitte versuch es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Gästebuch"
          subtitle="Hinterlasst uns eine Nachricht, einen Wunsch oder eine Erinnerung – für immer in unserem Herzen."
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <Card padding="lg" className="sticky top-24">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-dark-blue rounded-xl flex items-center justify-center">
                  <MessageSquare size={18} className="text-white" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-dark-blue">Eintrag hinterlassen</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="guestbook-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    <User size={14} className="inline mr-1" />
                    Dein Name
                  </label>
                  <input
                    id="guestbook-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Wie heißt du?"
                    maxLength={60}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="guestbook-message" className="block text-sm font-medium text-gray-700 mb-1.5">
                    <MessageSquare size={14} className="inline mr-1" />
                    Deine Nachricht
                  </label>
                  <textarea
                    id="guestbook-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Schreib dem Brautpaar eine Nachricht, einen Wunsch oder eine nette Erinnerung..."
                    rows={5}
                    maxLength={500}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm resize-none"
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">{message.length}/500</p>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button type="submit" size="lg" disabled={submitting} className="w-full">
                  <Send size={16} />
                  {submitting ? 'Wird eingetragen...' : 'Ins Gästebuch eintragen'}
                </Button>
              </form>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {entries.length === 0 && (
              <p className="text-sm text-gray-400">Noch keine Einträge – sei der/die Erste!</p>
            )}
            {entries.map((entry) => (
              <Card key={entry.id}>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-champagne text-dark-blue flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    {initialsOf(entry.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="font-semibold text-dark-blue text-sm truncate">{entry.name}</p>
                      <p className="text-xs text-gray-400 flex-shrink-0">{formatDate(entry.createdAt)}</p>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{entry.message}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/guestbook/page.test.tsx`
Expected: PASS (5/5)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/app/guestbook/page.tsx src/app/guestbook/page.test.tsx
git commit -m "Add guestbook page with form and entry list"
```

---

## Task 4: Erinnerungen — Datenzugriff & API-Routen

**Files:**
- Create: `src/lib/memories.ts`
- Test: `src/lib/memories.test.ts`
- Create: `src/app/api/memories/route.ts`
- Test: `src/app/api/memories/route.test.ts`
- Create: `src/app/api/memories/[id]/route.ts`
- Test: `src/app/api/memories/[id]/route.test.ts`

**Interfaces:**
- Consumes: `getDb()`, `RateLimiter`, `getClientKey`, `isAdminRequest`
  (Task 1), `verifyPassword` (`admin-auth.ts`).
- Produces: `interface MemoryEntry { id, name, message, photoKey, createdAt }`,
  `addMemoryEntry(db, name, message, photoKey): MemoryEntry`,
  `listMemoryEntries(db): MemoryEntry[]`,
  `deleteMemoryEntry(db, id): boolean`. Nur von diesem Task's eigenen
  Routen konsumiert.

- [ ] **Step 1: Test für die Zugriffsschicht schreiben**

```ts
// src/lib/memories.test.ts
import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { addMemoryEntry, deleteMemoryEntry, listMemoryEntries } from './memories'

describe('memories', () => {
  it('adds a text-only entry (photoKey null) and returns it', () => {
    const db = createDb(':memory:')
    const entry = addMemoryEntry(db, 'Anna', 'Ich erinnere mich an den Tag eures Kennenlernens.', null)

    expect(entry.id).toBeGreaterThan(0)
    expect(entry.photoKey).toBeNull()
    db.close()
  })

  it('lists entries newest first', () => {
    const db = createDb(':memory:')
    addMemoryEntry(db, 'Anna', 'Erste Erinnerung, lang genug für die Prüfung.', null)
    addMemoryEntry(db, 'Ben', 'Zweite Erinnerung, auch lang genug hier.', null)

    const entries = listMemoryEntries(db)
    expect(entries[0].name).toBe('Ben')
    expect(entries[1].name).toBe('Anna')
    db.close()
  })

  it('deletes an entry by id and returns true', () => {
    const db = createDb(':memory:')
    const entry = addMemoryEntry(db, 'Anna', 'Diese Erinnerung wird gleich gelöscht.', null)

    expect(deleteMemoryEntry(db, entry.id)).toBe(true)
    expect(listMemoryEntries(db)).toHaveLength(0)
    db.close()
  })

  it('returns false when deleting an id that does not exist', () => {
    const db = createDb(':memory:')
    expect(deleteMemoryEntry(db, 999999)).toBe(false)
    db.close()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/memories.test.ts`
Expected: FAIL — `Cannot find module './memories'`

- [ ] **Step 3: Zugriffsschicht implementieren**

```ts
// src/lib/memories.ts
import type Database from 'better-sqlite3'

export interface MemoryEntry {
  id: number
  name: string
  message: string
  photoKey: string | null
  createdAt: string
}

interface MemoryRow {
  id: number
  name: string
  message: string
  photo_key: string | null
  created_at: string
}

function toEntry(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    photoKey: row.photo_key,
    createdAt: row.created_at,
  }
}

export function addMemoryEntry(
  db: Database.Database,
  name: string,
  message: string,
  photoKey: string | null
): MemoryEntry {
  const result = db
    .prepare('INSERT INTO memories_entries (name, message, photo_key) VALUES (?, ?, ?)')
    .run(name, message, photoKey)
  const row = db
    .prepare('SELECT id, name, message, photo_key, created_at FROM memories_entries WHERE id = ?')
    .get(result.lastInsertRowid) as MemoryRow
  return toEntry(row)
}

export function listMemoryEntries(db: Database.Database): MemoryEntry[] {
  const rows = db
    .prepare('SELECT id, name, message, photo_key, created_at FROM memories_entries ORDER BY id DESC')
    .all() as MemoryRow[]
  return rows.map(toEntry)
}

export function deleteMemoryEntry(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM memories_entries WHERE id = ?').run(id)
  return result.changes > 0
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/memories.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: API-Routen-Tests schreiben**

```ts
// src/app/api/memories/route.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/memories', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalPassword = process.env.UPLOAD_PASSWORD_EMPFANG

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.UPLOAD_PASSWORD_EMPFANG = 'empfang-secret'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    process.env.UPLOAD_PASSWORD_EMPFANG = originalPassword
  })

  it('POST with the correct password adds a text-only entry', async () => {
    const response = await POST(
      postRequest({
        name: 'Anna',
        message: 'Ich erinnere mich an den Tag eures Kennenlernens.',
        password: 'empfang-secret',
      })
    )
    expect(response.status).toBe(201)

    const getResponse = await GET()
    const body = await getResponse.json()
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0].photoKey).toBeNull()
  })

  it('POST rejects a wrong password without revealing anything else', async () => {
    const response = await POST(
      postRequest({
        name: 'Anna',
        message: 'Ich erinnere mich an den Tag eures Kennenlernens.',
        password: 'falsches-kennwort',
      })
    )
    expect(response.status).toBe(401)

    const getResponse = await GET()
    const body = await getResponse.json()
    expect(body.entries).toHaveLength(0)
  })

  it('POST rejects a missing password', async () => {
    const response = await POST(
      postRequest({ name: 'Anna', message: 'Ich erinnere mich an den Tag eures Kennenlernens.' })
    )
    expect(response.status).toBe(401)
  })

  it('POST rejects a message shorter than 10 characters even with a correct password', async () => {
    const response = await POST(
      postRequest({ name: 'Anna', message: 'Kurz', password: 'empfang-secret' })
    )
    expect(response.status).toBe(400)
  })
})
```

```ts
// src/app/api/memories/[id]/route.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DELETE } from './route'
import { addMemoryEntry } from '@/lib/memories'
import { getDb } from '@/lib/db'
import { getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'
import { ADMIN_COOKIE_NAME } from '@/app/api/admin/login/route'

function deleteRequest(id: string, cookieValue?: string): Request {
  const headers = new Headers()
  if (cookieValue !== undefined) {
    headers.set('cookie', `${ADMIN_COOKIE_NAME}=${cookieValue}`)
  }
  return new Request(`http://localhost/api/memories/${id}`, { method: 'DELETE', headers })
}

describe('DELETE /api/memories/[id]', () => {
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

  it('deletes an entry when the request carries a valid admin cookie', async () => {
    const db = getDb()
    const entry = addMemoryEntry(db, 'Anna', 'Eine Erinnerung, die gelöscht werden soll.', null)
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await DELETE(deleteRequest(String(entry.id), cookieValue), {
      params: Promise.resolve({ id: String(entry.id) }),
    })
    expect(response.status).toBe(200)
  })

  it('rejects the request when there is no admin cookie', async () => {
    const db = getDb()
    const entry = addMemoryEntry(db, 'Anna', 'Eine Erinnerung, die bleiben soll.', null)

    const response = await DELETE(deleteRequest(String(entry.id)), {
      params: Promise.resolve({ id: String(entry.id) }),
    })
    expect(response.status).toBe(401)
  })

  it('returns 404 when deleting an id that does not exist, not a 500', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await DELETE(deleteRequest('999999', cookieValue), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/memories/route.test.ts src/app/api/memories/[id]/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (beide Dateien)

- [ ] **Step 7: API-Routen implementieren**

```ts
// src/app/api/memories/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { addMemoryEntry, listMemoryEntries } from '@/lib/memories'
import { verifyPassword } from '@/lib/admin-auth'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'

const entrySchema = z.object({
  name: z.string().trim().min(1).max(60),
  message: z.string().trim().min(10).max(500),
})

const memoriesLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
})

export async function GET(): Promise<Response> {
  const entries = listMemoryEntries(getDb())
  return NextResponse.json({ entries })
}

export async function POST(request: Request): Promise<Response> {
  const clientKey = getClientKey(request)
  const limit = memoriesLimiter.check(clientKey)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Einträge. Bitte später erneut versuchen.' },
      { status: 429 }
    )
  }

  const body = await request.json().catch(() => null)

  // Kennwort zuerst prüfen, bevor überhaupt auf Name/Nachricht geschaut
  // wird - ein falsches ODER fehlendes Kennwort verrät so nie, ob der
  // Rest der Eingabe sonst gültig gewesen wäre. verifyPassword hasht
  // immer zuerst (wie beim Admin-Login), auch ein leerer Kandidat landet
  // im zeitkonstanten Vergleich fester Länge, kein Orakel über die Länge.
  const uploadPassword = process.env.UPLOAD_PASSWORD_EMPFANG
  const candidatePassword =
    body && typeof body === 'object' && typeof (body as Record<string, unknown>).password === 'string'
      ? ((body as Record<string, unknown>).password as string)
      : ''
  if (!uploadPassword || !verifyPassword(candidatePassword, uploadPassword)) {
    return NextResponse.json({ error: 'Falsches Kennwort.' }, { status: 401 })
  }

  const parsed = entrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const entry = addMemoryEntry(getDb(), parsed.data.name, parsed.data.message, null)
  return NextResponse.json({ entry }, { status: 201 })
}
```

```ts
// src/app/api/memories/[id]/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { deleteMemoryEntry } from '@/lib/memories'
import { isAdminRequest } from '@/lib/admin-auth'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 })
  }

  const deleted = deleteMemoryEntry(db, numericId)
  if (!deleted) {
    return NextResponse.json({ error: 'Eintrag nicht gefunden.' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/memories/route.test.ts src/app/api/memories/[id]/route.test.ts`
Expected: PASS (4/4 und 3/3)

- [ ] **Step 9: Rate-Limit-Verhalten gezielt testen (Review Focus)**

```ts
// Ergänzung in src/app/api/memories/route.test.ts
it('blocks a sixth submission from the same IP within the window', async () => {
  const request = () =>
    new Request('http://localhost/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
      body: JSON.stringify({
        name: 'Anna',
        message: 'Eine gültige Erinnerung hier drin.',
        password: 'empfang-secret',
      }),
    })

  for (let i = 0; i < 5; i++) {
    const response = await POST(request())
    expect(response.status).toBe(201)
  }

  const sixth = await POST(request())
  expect(sixth.status).toBe(429)
})
```

- [ ] **Step 10: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/memories/route.test.ts`
Expected: PASS (5/5)

- [ ] **Step 11: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 12: Commit**

```bash
git add src/lib/memories.ts src/lib/memories.test.ts \
  src/app/api/memories/route.ts src/app/api/memories/route.test.ts \
  src/app/api/memories/\[id\]/route.ts src/app/api/memories/\[id\]/route.test.ts
git commit -m "Add memories data access layer and API routes"
```

---

## Task 5: Erinnerungen-Seite

**Files:**
- Create: `src/app/memories/page.tsx`
- Test: `src/app/memories/page.test.tsx`

**Interfaces:**
- Consumes: `SectionTitle`, `Card`, `Button` (inkl. der `type`-Prop aus
  Task 3), `GET /api/memories`, `POST /api/memories` (Task 4, über
  `fetch`).

- [ ] **Step 1: Test schreiben**

```tsx
// src/app/memories/page.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemoriesPage from './page'

function mockFetchSequence(responses: { status?: number; body: unknown }[]) {
  const fn = vi.fn()
  responses.forEach(({ status = 200, body }) => {
    fn.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('MemoriesPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and renders existing entries', async () => {
    mockFetchSequence([
      {
        body: {
          entries: [
            { id: 1, name: 'Anna', message: 'Ich erinnere mich an eure Verlobung.', photoKey: null, createdAt: '2026-10-11T10:00:00.000Z' },
          ],
        },
      },
    ])
    render(<MemoriesPage />)
    await waitFor(() => expect(screen.getByText('Ich erinnere mich an eure Verlobung.')).toBeInTheDocument())
  })

  it('submits a new entry with the password and shows it in the list', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { status: 201, body: { entry: { id: 2, name: 'Ben', message: 'Ein toller gemeinsamer Abend war das.', photoKey: null, createdAt: '2026-10-11T11:00:00.000Z' } } },
    ])

    render(<MemoriesPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await userEvent.type(screen.getByLabelText(/Name/i), 'Ben')
    await userEvent.type(screen.getByLabelText(/Erinnerung/i), 'Ein toller gemeinsamer Abend war das.')
    await userEvent.type(screen.getByLabelText(/Kennwort/i), 'empfang-secret')
    await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

    await waitFor(() => expect(screen.getByText('Ein toller gemeinsamer Abend war das.')).toBeInTheDocument())
  })

  it('shows an error when the password is rejected by the server', async () => {
    const fetchMock = mockFetchSequence([
      { body: { entries: [] } },
      { status: 401, body: { error: 'Falsches Kennwort.' } },
    ])

    render(<MemoriesPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await userEvent.type(screen.getByLabelText(/Name/i), 'Ben')
    await userEvent.type(screen.getByLabelText(/Erinnerung/i), 'Ein toller gemeinsamer Abend war das.')
    await userEvent.type(screen.getByLabelText(/Kennwort/i), 'falsch')
    await userEvent.click(screen.getByRole('button', { name: /teilen/i }))

    await waitFor(() => expect(screen.getByText(/falsches kennwort/i)).toBeInTheDocument())
  })

  it('carries its own top offset below the fixed navigation', async () => {
    mockFetchSequence([{ body: { entries: [] } }])
    const { container } = render(<MemoriesPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pt-24'))
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/memories/page.test.tsx`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: Seite implementieren**

```tsx
// src/app/memories/page.tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Heart, KeyRound, Send, User } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

interface MemoryEntry {
  id: number
  name: string
  message: string
  photoKey: string | null
  createdAt: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MemoriesPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/memories')
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data: { entries: MemoryEntry[] }) => setEntries(data.entries))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedMessage = message.trim()
    if (!name.trim()) {
      setError('Bitte gib deinen Namen ein.')
      return
    }
    if (trimmedMessage.length < 10) {
      setError('Deine Erinnerung ist zu kurz. Bitte schreib mindestens 10 Zeichen.')
      return
    }
    if (!password) {
      setError('Bitte gib das Kennwort vom Empfang ein.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), message: trimmedMessage, password }),
      })
      if (response.status === 401) {
        setError('Falsches Kennwort.')
        return
      }
      if (!response.ok) {
        setError('Erinnerung konnte nicht gespeichert werden. Bitte versuch es erneut.')
        return
      }
      const data = (await response.json()) as { entry: MemoryEntry }
      setEntries((prev) => [data.entry, ...prev])
      setName('')
      setMessage('')
      setPassword('')
    } catch {
      setError('Erinnerung konnte nicht gespeichert werden. Bitte versuch es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Erinnerungen"
          subtitle="Teilt eure Erinnerungen an uns und diesen Tag – mit dem Kennwort, das ihr am Empfang bekommen habt."
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <Card padding="lg" className="sticky top-24">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-dark-blue rounded-xl flex items-center justify-center">
                  <Heart size={18} className="text-white" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-dark-blue">Erinnerung teilen</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="memories-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    <User size={14} className="inline mr-1" />
                    Dein Name
                  </label>
                  <input
                    id="memories-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Wie heißt du?"
                    maxLength={60}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="memories-message" className="block text-sm font-medium text-gray-700 mb-1.5">
                    <Heart size={14} className="inline mr-1" />
                    Deine Erinnerung
                  </label>
                  <textarea
                    id="memories-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Was ist dir besonders in Erinnerung geblieben?"
                    rows={5}
                    maxLength={500}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm resize-none"
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">{message.length}/500</p>
                </div>

                <div>
                  <label htmlFor="memories-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    <KeyRound size={14} className="inline mr-1" />
                    Kennwort vom Empfang
                  </label>
                  <input
                    id="memories-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Kennwort"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button type="submit" size="lg" disabled={submitting} className="w-full">
                  <Send size={16} />
                  {submitting ? 'Wird geteilt...' : 'Erinnerung teilen'}
                </Button>
              </form>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {entries.length === 0 && (
              <p className="text-sm text-gray-400">Noch keine Erinnerungen – teilt eure erste!</p>
            )}
            {entries.map((entry) => (
              <Card key={entry.id}>
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 bg-champagne rounded-full flex items-center justify-center flex-shrink-0">
                    <Heart size={16} className="text-dark-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-dark-blue truncate">{entry.name}</p>
                    <p className="text-xs text-gray-400">{formatDate(entry.createdAt)}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed italic">&quot;{entry.message}&quot;</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/memories/page.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 5: Gesamte Toolchain inklusive Build prüfen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün.

- [ ] **Step 6: Commit**

```bash
git add src/app/memories/page.tsx src/app/memories/page.test.tsx
git commit -m "Add memories page with password-gated form and entry list"
```

---

## Abschluss

Nach Task 5 sind Gästebuch und Erinnerungen live, erreichbar über die
bereits bestehende Navigation. Beide Lösch-Routen sind admin-geschützt,
aber ohne eigenes Admin-UI - das folgt im nächsten Plan zusammen mit dem
Galerie-Modus-Schalter. Der Foto-Upload für Erinnerungen bleibt
zurückgestellt, bis die R2-Zugangsdaten vorliegen (siehe `TODO.md`) -
dann wird `photoKey` befüllt, ohne dass sich an `memories_entries` oder
den bestehenden Routen sonst etwas ändern muss.
