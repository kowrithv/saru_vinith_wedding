# Grundgerüst Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein lauffähiges, getestetes Next.js-Grundgerüst mit Env-Validierung,
SQLite-Anbindung, Rate-Limiting und Admin-Login — die Basis, auf der alle
weiteren Pläne (Quiz, Galerie, Gästebuch, Erinnerungen, Admin-Dashboard)
aufbauen.

**Architecture:** Next.js 16 App Router, SQLite (`better-sqlite3`) als einzige
Datenhaltung, zustandslose In-Memory-Primitiven (Rate-Limiter) pro
Node-Prozess. Jedes `src/lib/*`-Modul ist eine reine, isoliert testbare
Einheit; API-Routen sind dünne Adapter, die diese Module verdrahten.

**Tech Stack:** Next.js 16.4.0 · React/react-dom 19.3.0 · TypeScript 6.0.3 ·
Tailwind CSS 4.3.3 · better-sqlite3 13.0.3 · Vitest 5 + React Testing Library
· Zod 4 · Node.js 24.x LTS · Docker (`node:24-alpine`) · Caddy 2.9 ·
`willfarrell/autoheal`.

**Spec:** `docs/superpowers/specs/2026-10-11-rewrite-design.md`

## Global Constraints

- Node.js 24.x LTS (`node:24-alpine` im Docker-Image). Nie Node 26 verwenden,
  bevor es am 28.10.2026 LTS wird.
- Exakt gepinnte Kernversionen, keine `^`/`~`-Ranges: `next@16.4.0`,
  `react@19.3.0`, `react-dom@19.3.0`, `typescript@6.0.3` (**nicht** `7.x`),
  `tailwindcss@4.3.3`, `better-sqlite3@13.0.3`, `eslint@10.12.0`,
  `eslint-config-next@16.4.0`.
- Kein Code aus der alten App übernehmen. Die alte App (erreichbar über den
  Git-Branch `clean-start`) ist nur Inhalts-/Funktionsreferenz, nie
  Code-Vorlage.
- TDD ist Pflicht für jede Funktion: Test schreiben → rot sehen → minimal
  implementieren → grün → Refactor. Kein Schritt wird übersprungen, auch
  nicht für kleine Funktionen.
- Fehlermeldungen und Oberflächentexte sind auf Deutsch.
- Kein Redis oder sonstiger externer State-Store. Ein Prozess, ein Container
  — In-Memory reicht für Rate-Limiting.
- Passwortvergleiche vergleichen immer feste Hash-Längen (SHA-256 +
  `timingSafeEqual`), nie die Rohlänge der Eingabe.
- Kein generisches Admin-CMS, keine `revealAt`-Terminsteuerung — nicht Teil
  dieses oder späterer Pläne.

## Review Focus

- Ein manipuliertes/fehlerhaft formatiertes Admin-Cookie (falsche Länge,
  falsche Signatur, kaputtes Format) darf den Request nie mit einer
  Exception abbrechen, sondern muss ihn als „nicht angemeldet" behandeln.
- Fehlt `ADMIN_PASSWORD` zur Laufzeit, muss die Login-Route einen sauberen
  Fehler mit deutscher Meldung liefern statt abzustürzen oder eine
  JavaScript-Exception durchzulassen.
- Eine `UNIQUE`-Constraint-Verletzung in SQLite (z. B. später beim Quiz)
  muss anhand eines stabilen Fehlercodes erkennbar sein, nicht nur als
  generischer 500er durchschlagen.
- Ein Request exakt an der Rate-Limit-Fenstergrenze darf nicht durch einen
  Rundungsfehler doppelt gezählt oder zu Unrecht abgelehnt werden.
- Der `/api/health`-Endpunkt (Docker-`HEALTHCHECK`-Ziel) darf unter keinen
  Umständen die Datenbank anfassen — sonst wird er selbst zur Störquelle bei
  Last (siehe Review-Befund M4 der alten App).

---

## Task 1: Projekt-Setup & Health-Endpoint

Beweist, dass die gesamte Toolchain (TypeScript, Next.js, Tailwind, Vitest,
ESLint) zusammen funktioniert — am kleinstmöglichen echten Feature.

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `.gitignore`
- Create: `.dockerignore`
- Create: `.env.example`
- Create: `public/.gitkeep`
- Create: `src/app/globals.css`
- Create: `src/app/api/health/route.ts`
- Test: `src/app/api/health/route.test.ts`

**Interfaces:**
- Produces: `GET` handler at `/api/health` returning `{ ok: true }`, status
  200, **ohne** Datenbankzugriff. Spätere Tasks/Docker-Healthcheck
  konsumieren diese Route per HTTP.

- [ ] **Step 1: `package.json` anlegen**

```json
{
  "name": "saru-vinith-wedding",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "16.4.0",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "better-sqlite3": "13.0.3",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "@types/node": "24.19.2",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@types/better-sqlite3": "9.6.0",
    "eslint": "10.12.0",
    "eslint-config-next": "16.4.0",
    "tailwindcss": "4.3.3",
    "@tailwindcss/postcss": "4.3.3",
    "postcss": "8.5.29",
    "vitest": "5.0.3",
    "@vitejs/plugin-react": "6.1.2",
    "@testing-library/react": "16.3.3",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/user-event": "14.6.7",
    "jsdom": "30.1.2",
    "vite-tsconfig-paths": "6.1.1"
  }
}
```

- [ ] **Step 2: `tsconfig.json` anlegen**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: `next.config.ts` anlegen**

```ts
import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
```

- [ ] **Step 4: `postcss.config.mjs` anlegen**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

- [ ] **Step 5: `eslint.config.mjs` anlegen**

```js
import nextConfig from 'eslint-config-next'

export default [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**'],
  },
]
```

- [ ] **Step 6: `vitest.config.ts` und `vitest.setup.ts` anlegen**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
})
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 7: `.gitignore`, `.dockerignore`, `.env.example`, `public/.gitkeep` anlegen**

```
# .gitignore
node_modules/
.next/
out/
build/
dist/
.env
.env.local
.env.production
.env.development.local
.env.test.local
.env.production.local
.env*.local
npm-debug.log*
.DS_Store
Thumbs.db
.vscode/
.idea/
*.swp
*.swo
*~
*.tsbuildinfo
next-env.d.ts
/coverage
data/*.db
data/*.db-*
```

```
# .dockerignore
node_modules
.next
.git
.github
.env
.env.local
.env.production
.env*.local
npm-debug.log*
*.tsbuildinfo
.DS_Store
README.md
docs
data/*.db
data/*.db-*
```

```
# .env.example
# Vorlage: cp .env.example .env.local (lokal) bzw. .env.production (Server)
ADMIN_PASSWORD=
# Optional - wird sonst automatisch erzeugt und in der DB gespeichert
ADMIN_SECRET=
UPLOAD_PASSWORD_EMPFANG=
```

`public/.gitkeep` ist eine leere Datei — Git trackt keine leeren
Verzeichnisse, der Docker-Build (Task 8) braucht `public/` aber als
existierendes Verzeichnis zum Kopieren.

- [ ] **Step 8: `src/app/globals.css` anlegen**

```css
@import "tailwindcss";
```

- [ ] **Step 9: Test für den Health-Endpoint schreiben**

```ts
// src/app/api/health/route.test.ts
import { describe, expect, it } from 'vitest'
import { GET } from './route'

describe('GET /api/health', () => {
  it('returns ok:true with status 200', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('answers even when the database path is invalid, proving it never touches the DB', async () => {
    const original = process.env.DATABASE_PATH
    process.env.DATABASE_PATH = '/does/not/exist/wedding.db'
    try {
      const response = await GET()
      expect(response.status).toBe(200)
    } finally {
      process.env.DATABASE_PATH = original
    }
  })
})
```

- [ ] **Step 10: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm install && npx vitest run src/app/api/health/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (Datei existiert noch nicht).

- [ ] **Step 11: Minimale Implementierung**

```ts
// src/app/api/health/route.ts
export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
```

- [ ] **Step 12: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/health/route.test.ts`
Expected: PASS

- [ ] **Step 13: Toolchain als Ganzes prüfen**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: alle drei Befehle laufen ohne Fehler durch (der `build`-Schritt
erzeugt u. a. `.next/standalone`, weil `output: 'standalone'` gesetzt ist).

- [ ] **Step 14: Commit**

```bash
git add package.json tsconfig.json next.config.ts postcss.config.mjs \
  eslint.config.mjs vitest.config.ts vitest.setup.ts .gitignore \
  .dockerignore .env.example public/.gitkeep src/app/globals.css \
  src/app/api/health/route.ts src/app/api/health/route.test.ts \
  package-lock.json
git commit -m "Set up project toolchain with a DB-free health endpoint"
```

---

## Task 2: Env-Validierung

**Files:**
- Create: `src/lib/env.ts`
- Test: `src/lib/env.test.ts`
- Create: `src/instrumentation.ts`
- Test: `src/instrumentation.test.ts`

**Interfaces:**
- Consumes: nichts (reine Funktion über `NodeJS.ProcessEnv`)
- Produces: `validateEnv(source?: NodeJS.ProcessEnv): AppEnv`,
  `class MissingEnvError extends Error { missing: string[] }`. Spätere
  Pläne (Galerie/Erinnerungen) erweitern die Liste der Pflichtvariablen in
  `REQUIRED_KEYS`, wenn sie `UPLOAD_PASSWORD_EMPFANG` tatsächlich brauchen.

- [ ] **Step 1: Test für `validateEnv` schreiben**

```ts
// src/lib/env.test.ts
import { describe, expect, it } from 'vitest'
import { MissingEnvError, validateEnv } from './env'

describe('validateEnv', () => {
  it('returns the parsed env when ADMIN_PASSWORD is set', () => {
    const result = validateEnv({ ADMIN_PASSWORD: 'secret' })
    expect(result.adminPassword).toBe('secret')
  })

  it('throws MissingEnvError listing every missing key', () => {
    expect(() => validateEnv({})).toThrowError(MissingEnvError)
    try {
      validateEnv({})
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError)
      expect((error as MissingEnvError).missing).toEqual(['ADMIN_PASSWORD'])
    }
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/env.test.ts`
Expected: FAIL — `Cannot find module './env'`

- [ ] **Step 3: Minimale Implementierung**

```ts
// src/lib/env.ts
const REQUIRED_KEYS = ['ADMIN_PASSWORD'] as const

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
}

export function validateEnv(
  source: NodeJS.ProcessEnv = process.env
): AppEnv {
  const missing = REQUIRED_KEYS.filter((key) => !source[key])
  if (missing.length > 0) {
    throw new MissingEnvError(missing)
  }
  return {
    adminPassword: source.ADMIN_PASSWORD as string,
  }
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/env.test.ts`
Expected: PASS

- [ ] **Step 5: Test für `instrumentation.ts` schreiben**

```ts
// src/instrumentation.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { register } from './instrumentation'

describe('register', () => {
  const originalAdminPassword = process.env.ADMIN_PASSWORD

  afterEach(() => {
    process.env.ADMIN_PASSWORD = originalAdminPassword
    vi.restoreAllMocks()
  })

  it('does not exit when required env vars are present', () => {
    process.env.ADMIN_PASSWORD = 'secret'
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called')
    })
    expect(() => register()).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('logs a German error and exits with code 1 when a var is missing', () => {
    delete process.env.ADMIN_PASSWORD
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    register()

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fehlende Pflicht-Umgebungsvariablen')
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/instrumentation.test.ts`
Expected: FAIL — `Cannot find module './instrumentation'`

- [ ] **Step 7: Minimale Implementierung**

```ts
// src/instrumentation.ts
import { MissingEnvError, validateEnv } from '@/lib/env'

export function register(): void {
  try {
    validateEnv()
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error(`FEHLER: ${error.message}`)
      process.exit(1)
      return
    }
    throw error
  }
}
```

- [ ] **Step 8: Tests erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/instrumentation.test.ts src/lib/env.test.ts`
Expected: PASS (beide Dateien)

- [ ] **Step 9: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 10: Commit**

```bash
git add src/lib/env.ts src/lib/env.test.ts src/instrumentation.ts \
  src/instrumentation.test.ts
git commit -m "Add startup env validation that fails fast in German"
```

---

## Task 3: SQLite-Datenbankmodul & Schema

**Files:**
- Create: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: `better-sqlite3`'s `Database` Typ direkt.
- Produces: `applySchema(db: Database.Database): void`,
  `createDb(path: string): Database.Database`, `getDb(): Database.Database`.
  Alle späteren Module (Admin-Auth, Quiz, Galerie, Gästebuch, Erinnerungen)
  rufen `getDb()` auf, um Zugriff auf dieselbe Verbindung zu bekommen, und
  verwenden `createDb(':memory:')` in ihren eigenen Tests.

- [ ] **Step 1: Tests für Schema und Verbindung schreiben**

```ts
// src/lib/db.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb, getDb } from './db'

describe('createDb', () => {
  it('creates all five application tables', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name)

    expect(tables).toEqual(
      expect.arrayContaining([
        'who_votes',
        'gallery_photos',
        'guestbook_entries',
        'memories_entries',
        'app_config',
      ])
    )
    db.close()
  })

  it('enforces one vote per question per voter', () => {
    const db = createDb(':memory:')
    const insert = db.prepare(
      'INSERT INTO who_votes (question_id, voter_id, option) VALUES (?, ?, ?)'
    )
    insert.run('q1', 'voter-1', 'Saruga')

    expect(() => insert.run('q1', 'voter-1', 'Vinith')).toThrowError(
      /UNIQUE constraint failed/
    )

    try {
      insert.run('q1', 'voter-1', 'Vinith')
    } catch (error) {
      expect((error as { code: string }).code).toBe(
        'SQLITE_CONSTRAINT_UNIQUE'
      )
    }
    db.close()
  })
})

describe('getDb', () => {
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

  it('returns the same connection on repeated calls', () => {
    expect(getDb()).toBe(getDb())
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/db.test.ts`
Expected: FAIL — `Cannot find module './db'`

- [ ] **Step 3: Minimale Implementierung**

```ts
// src/lib/db.ts
import Database from 'better-sqlite3'

export function applySchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  db.exec(`
    CREATE TABLE IF NOT EXISTS who_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      option TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(question_id, voter_id)
    );

    CREATE TABLE IF NOT EXISTS gallery_photos (
      id TEXT PRIMARY KEY,
      thumb_key TEXT NOT NULL,
      original_key TEXT NOT NULL,
      uploader_name TEXT NOT NULL,
      delete_token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS guestbook_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS memories_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      photo_key TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

export function createDb(path: string): Database.Database {
  const db = new Database(path)
  applySchema(db)
  return db
}

declare global {
  // eslint-disable-next-line no-var
  var __appDb: Database.Database | undefined
}

export function getDb(): Database.Database {
  if (!globalThis.__appDb) {
    const path = process.env.DATABASE_PATH ?? 'data/wedding.db'
    globalThis.__appDb = createDb(path)
  }
  return globalThis.__appDb
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/db.test.ts`
Expected: PASS

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "Add SQLite schema and connection module"
```

---

## Task 4: Rate-Limiter

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `src/lib/rate-limit.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `class RateLimiter { constructor(options: RateLimiterOptions); check(key: string): RateLimitResult; reset(key: string): void }`,
  `interface RateLimiterOptions { maxAttempts: number; windowMs: number; now?: () => number }`,
  `interface RateLimitResult { allowed: boolean; retryAfterMs: number }`.
  Task 6 (Login-Route) und spätere Pläne (Gästebuch, Erinnerungen,
  Upload-Anfrage) instanziieren jeweils ihren eigenen `RateLimiter`.

- [ ] **Step 1: Ersten Test schreiben — erlaubt bis `maxAttempts`**

```ts
// src/lib/rate-limit.test.ts
import { describe, expect, it } from 'vitest'
import { RateLimiter } from './rate-limit'

describe('RateLimiter', () => {
  it('allows up to maxAttempts requests within the window', () => {
    const limiter = new RateLimiter({ maxAttempts: 3, windowMs: 1000 })
    expect(limiter.check('ip-1').allowed).toBe(true)
    expect(limiter.check('ip-1').allowed).toBe(true)
    expect(limiter.check('ip-1').allowed).toBe(true)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/rate-limit.test.ts`
Expected: FAIL — `Cannot find module './rate-limit'`

- [ ] **Step 3: Minimale Implementierung**

```ts
// src/lib/rate-limit.ts
export interface RateLimiterOptions {
  maxAttempts: number
  windowMs: number
  now?: () => number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

interface Bucket {
  count: number
  windowStart: number
}

export class RateLimiter {
  private readonly maxAttempts: number
  private readonly windowMs: number
  private readonly now: () => number
  private readonly buckets = new Map<string, Bucket>()

  constructor(options: RateLimiterOptions) {
    this.maxAttempts = options.maxAttempts
    this.windowMs = options.windowMs
    this.now = options.now ?? Date.now
  }

  check(key: string): RateLimitResult {
    const now = this.now()
    const bucket = this.buckets.get(key)

    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now })
      return { allowed: true, retryAfterMs: 0 }
    }

    if (bucket.count < this.maxAttempts) {
      bucket.count += 1
      return { allowed: true, retryAfterMs: 0 }
    }

    return {
      allowed: false,
      retryAfterMs: bucket.windowStart + this.windowMs - now,
    }
  }

  reset(key: string): void {
    this.buckets.delete(key)
  }
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/rate-limit.test.ts`
Expected: PASS

- [ ] **Step 5: Test — die `(maxAttempts+1)`-te Anfrage wird abgelehnt**

```ts
it('rejects the request after maxAttempts within the window', () => {
  const limiter = new RateLimiter({ maxAttempts: 2, windowMs: 1000 })
  limiter.check('ip-1')
  limiter.check('ip-1')
  const result = limiter.check('ip-1')
  expect(result.allowed).toBe(false)
  expect(result.retryAfterMs).toBeGreaterThan(0)
})
```

Run: `npx vitest run src/lib/rate-limit.test.ts` → erwartet PASS ohne weitere
Code-Änderung (vom vorherigen Schritt bereits abgedeckt).

- [ ] **Step 6: Test — Fenster läuft ab, danach wieder erlaubt (inkl. Grenzfall)**

```ts
it('allows requests again once the window has fully elapsed', () => {
  let current = 0
  const limiter = new RateLimiter({
    maxAttempts: 1,
    windowMs: 1000,
    now: () => current,
  })
  limiter.check('ip-1')
  current = 999
  expect(limiter.check('ip-1').allowed).toBe(false)
  current = 1000
  expect(limiter.check('ip-1').allowed).toBe(true)
})

it('tracks separate keys independently', () => {
  const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 1000 })
  expect(limiter.check('ip-1').allowed).toBe(true)
  expect(limiter.check('ip-2').allowed).toBe(true)
  expect(limiter.check('ip-1').allowed).toBe(false)
})
```

Run: `npx vitest run src/lib/rate-limit.test.ts`
Expected: PASS (die bestehende Implementierung aus Step 3 deckt beide Fälle
bereits korrekt ab — `now - bucket.windowStart >= this.windowMs` behandelt
genau den Grenzfall `999` vs. `1000`).

- [ ] **Step 7: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 8: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts
git commit -m "Add in-memory rate limiter"
```

---

## Task 5: Admin-Auth-Primitiven

**Files:**
- Create: `src/lib/admin-auth.ts`
- Test: `src/lib/admin-auth.test.ts`

**Interfaces:**
- Consumes: `createDb`/`Database.Database` aus Task 3.
- Produces: `hashPassword(password: string): string`,
  `verifyPassword(candidate: string, expectedPlain: string): boolean`,
  `getOrCreateAdminSecret(db: Database.Database): string`,
  `signCookieValue(expiresAt: number, secret: string): string`,
  `verifyCookieValue(value: string, secret: string, now?: number): boolean`,
  `ADMIN_SESSION_DURATION_MS: number`. Task 6 (Login/Logout-Routen) und
  spätere Admin-Dashboard-Pläne konsumieren all das.

- [ ] **Step 1: Test für Passwort-Hashing/-Vergleich schreiben**

```ts
// src/lib/admin-auth.test.ts
import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import {
  getOrCreateAdminSecret,
  hashPassword,
  signCookieValue,
  verifyCookieValue,
  verifyPassword,
} from './admin-auth'

describe('verifyPassword', () => {
  it('returns true for the correct password', () => {
    expect(verifyPassword('geheim123', 'geheim123')).toBe(true)
  })

  it('returns false for an incorrect password', () => {
    expect(verifyPassword('falsch', 'geheim123')).toBe(false)
  })

  it('compares fixed-length hashes rather than the raw inputs', () => {
    // Unterschiedliche Längen dürfen nicht an timingSafeEqual
    // durchschlagen, weil beide Seiten zuerst gehasht werden.
    expect(() => verifyPassword('a', 'ein-sehr-langes-passwort')).not.toThrow()
    expect(verifyPassword('a', 'ein-sehr-langes-passwort')).toBe(false)
  })
})

describe('hashPassword', () => {
  it('produces a 64-character hex digest', () => {
    expect(hashPassword('x')).toMatch(/^[0-9a-f]{64}$/)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/admin-auth.test.ts`
Expected: FAIL — `Cannot find module './admin-auth'`

- [ ] **Step 3: Passwort-Funktionen implementieren**

```ts
// src/lib/admin-auth.ts
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type Database from 'better-sqlite3'

export function hashPassword(password: string): string {
  return createHash('sha256').update(password, 'utf8').digest('hex')
}

export function verifyPassword(
  candidate: string,
  expectedPlain: string
): boolean {
  const candidateHash = Buffer.from(hashPassword(candidate), 'hex')
  const expectedHash = Buffer.from(hashPassword(expectedPlain), 'hex')
  return timingSafeEqual(candidateHash, expectedHash)
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/admin-auth.test.ts`
Expected: PASS (nur die ersten vier Tests existieren bisher)

- [ ] **Step 5: Test für `getOrCreateAdminSecret` schreiben**

```ts
describe('getOrCreateAdminSecret', () => {
  const originalEnvSecret = process.env.ADMIN_SECRET

  afterEach(() => {
    process.env.ADMIN_SECRET = originalEnvSecret
  })

  it('prefers the ADMIN_SECRET env var when set', () => {
    process.env.ADMIN_SECRET = 'from-env'
    const db = createDb(':memory:')
    expect(getOrCreateAdminSecret(db)).toBe('from-env')
    db.close()
  })

  it('generates and persists a secret when neither env nor DB has one', () => {
    delete process.env.ADMIN_SECRET
    const db = createDb(':memory:')
    const generated = getOrCreateAdminSecret(db)
    expect(generated).toMatch(/^[0-9a-f]{64}$/)
    expect(getOrCreateAdminSecret(db)).toBe(generated)
    db.close()
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/admin-auth.test.ts`
Expected: FAIL — `getOrCreateAdminSecret is not a function`

- [ ] **Step 7: `getOrCreateAdminSecret` implementieren**

```ts
const ADMIN_SECRET_CONFIG_KEY = 'admin_secret'

export function getOrCreateAdminSecret(db: Database.Database): string {
  const envSecret = process.env.ADMIN_SECRET
  if (envSecret) {
    return envSecret
  }

  const row = db
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .get(ADMIN_SECRET_CONFIG_KEY) as { value: string } | undefined

  if (row) {
    return row.value
  }

  const generated = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO app_config (key, value) VALUES (?, ?)').run(
    ADMIN_SECRET_CONFIG_KEY,
    generated
  )
  return generated
}
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/admin-auth.test.ts`
Expected: PASS

- [ ] **Step 9: Tests für das Cookie-Signieren/-Prüfen schreiben**

```ts
describe('signCookieValue / verifyCookieValue', () => {
  it('verifies a freshly signed, not-yet-expired cookie', () => {
    const expiresAt = Date.now() + 10_000
    const value = signCookieValue(expiresAt, 'secret')
    expect(verifyCookieValue(value, 'secret', Date.now())).toBe(true)
  })

  it('rejects a cookie signed with a different secret', () => {
    const expiresAt = Date.now() + 10_000
    const value = signCookieValue(expiresAt, 'secret-a')
    expect(verifyCookieValue(value, 'secret-b', Date.now())).toBe(false)
  })

  it('rejects an expired cookie', () => {
    const expiresAt = Date.now() - 1
    const value = signCookieValue(expiresAt, 'secret')
    expect(verifyCookieValue(value, 'secret', Date.now())).toBe(false)
  })

  it('rejects a malformed cookie value without throwing', () => {
    expect(() => verifyCookieValue('garbage', 'secret')).not.toThrow()
    expect(verifyCookieValue('garbage', 'secret')).toBe(false)
  })

  it('rejects a tampered signature of different length without throwing', () => {
    const expiresAt = Date.now() + 10_000
    const value = signCookieValue(expiresAt, 'secret')
    const [expiresAtPart] = value.split('.')
    const tampered = `${expiresAtPart}.ab`
    expect(() => verifyCookieValue(tampered, 'secret')).not.toThrow()
    expect(verifyCookieValue(tampered, 'secret')).toBe(false)
  })
})
```

- [ ] **Step 10: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/admin-auth.test.ts`
Expected: FAIL — `signCookieValue is not a function`

- [ ] **Step 11: Cookie-Funktionen implementieren**

```ts
export const ADMIN_SESSION_DURATION_MS = 12 * 60 * 60 * 1000 // 12h

export function signCookieValue(expiresAt: number, secret: string): string {
  const signature = createHmac('sha256', secret)
    .update(String(expiresAt))
    .digest('hex')
  return `${expiresAt}.${signature}`
}

export function verifyCookieValue(
  value: string,
  secret: string,
  now: number = Date.now()
): boolean {
  const separatorIndex = value.indexOf('.')
  if (separatorIndex === -1) {
    return false
  }

  const expiresAtPart = value.slice(0, separatorIndex)
  const signaturePart = value.slice(separatorIndex + 1)
  const expiresAt = Number(expiresAtPart)
  if (!Number.isFinite(expiresAt)) {
    return false
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(expiresAtPart)
    .digest('hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  const actualBuffer = Buffer.from(signaturePart, 'hex')

  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
    return false
  }

  return expiresAt > now
}
```

- [ ] **Step 12: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/admin-auth.test.ts`
Expected: PASS (alle 11 Tests in dieser Datei)

- [ ] **Step 13: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 14: Commit**

```bash
git add src/lib/admin-auth.ts src/lib/admin-auth.test.ts
git commit -m "Add admin password hashing and signed-cookie primitives"
```

---

## Task 6: Admin-Login- und Logout-Route

**Files:**
- Create: `src/app/api/admin/login/route.ts`
- Test: `src/app/api/admin/login/route.test.ts`
- Create: `src/app/api/admin/logout/route.ts`
- Test: `src/app/api/admin/logout/route.test.ts`

**Interfaces:**
- Consumes: `getDb` (Task 3), `RateLimiter` (Task 4), `getOrCreateAdminSecret`,
  `signCookieValue`, `verifyPassword`, `ADMIN_SESSION_DURATION_MS` (Task 5).
- Produces: `ADMIN_COOKIE_NAME: string` (exportiert aus der Login-Route,
  von der Logout-Route und von späteren Admin-Dashboard-Plänen
  importiert), `POST`-Handler auf beiden Routen.

- [ ] **Step 1: Test für falsches Passwort schreiben**

```ts
// src/app/api/admin/login/route.test.ts
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
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/admin/login/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Login-Route implementieren**

```ts
// src/app/api/admin/login/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import {
  ADMIN_SESSION_DURATION_MS,
  getOrCreateAdminSecret,
  signCookieValue,
  verifyPassword,
} from '@/lib/admin-auth'
import { RateLimiter } from '@/lib/rate-limit'

export const ADMIN_COOKIE_NAME = 'admin_session'

const loginSchema = z.object({ password: z.string().min(1) })

const loginLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
})

function getClientKey(request: Request): string {
  return request.headers.get('x-forwarded-for') ?? 'local'
}

export async function POST(request: Request): Promise<Response> {
  const clientKey = getClientKey(request)
  const limit = loginLimiter.check(clientKey)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Versuche. Bitte später erneut versuchen.' },
      { status: 429 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json(
      { error: 'Admin-Login ist nicht konfiguriert.' },
      { status: 500 }
    )
  }

  if (!verifyPassword(parsed.data.password, adminPassword)) {
    return NextResponse.json({ error: 'Falsches Passwort.' }, { status: 401 })
  }

  const secret = getOrCreateAdminSecret(getDb())
  const expiresAt = Date.now() + ADMIN_SESSION_DURATION_MS
  const cookieValue = signCookieValue(expiresAt, secret)

  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  })
  return response
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/admin/login/route.test.ts`
Expected: PASS

- [ ] **Step 5: Weitere Tests — Erfolg, Rate-Limit, ungültiger Body**

```ts
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

it('returns 500 with a German message when ADMIN_PASSWORD is unset, without throwing', async () => {
  delete process.env.ADMIN_PASSWORD
  const response = await POST(loginRequest('irgendwas', '203.0.113.50'))
  expect(response.status).toBe(500)
  await expect(response.json()).resolves.toEqual({
    error: 'Admin-Login ist nicht konfiguriert.',
  })
})
```

- [ ] **Step 6: Tests laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/admin/login/route.test.ts`
Expected: PASS (alle 6 Tests in dieser Datei — jeder Test nutzt eine eigene
IP, damit sich die Rate-Limit-Buckets nicht gegenseitig stören, außer dem
Test, der das Rate-Limit absichtlich prüft. Der bestehende `beforeEach`
setzt `ADMIN_PASSWORD` vor **jedem** Test neu auf `'richtiges-passwort'`,
daher hebt der `delete` im Unset-Test keinen anderen Test aus — unabhängig
von der Ausführungsreihenfolge.)

- [ ] **Step 7: Logout-Route mit Test schreiben**

```ts
// src/app/api/admin/logout/route.test.ts
import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('POST /api/admin/logout', () => {
  it('clears the admin cookie', async () => {
    const response = await POST()
    expect(response.status).toBe(200)
    const cookie = response.headers.get('set-cookie')
    expect(cookie).toContain('admin_session=')
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/)
  })
})
```

Run: `npx vitest run src/app/api/admin/logout/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

```ts
// src/app/api/admin/logout/route.ts
import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME } from '../login/route'

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(ADMIN_COOKIE_NAME)
  return response
}
```

Run: `npx vitest run src/app/api/admin/logout/route.test.ts`
Expected: PASS

- [ ] **Step 8: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 9: Commit**

```bash
git add src/app/api/admin/login/route.ts src/app/api/admin/login/route.test.ts \
  src/app/api/admin/logout/route.ts src/app/api/admin/logout/route.test.ts
git commit -m "Add rate-limited admin login and logout routes"
```

---

## Task 7: Root-Layout, Robots & Platzhalter-Startseite

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/robots.ts`
- Create: `src/app/page.tsx`
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Produces: `RootLayout` (von jeder Seite verwendet), `HomePage`. Spätere
  Pläne (Story/Info/FAQ, Navigation) ersetzen/erweitern `page.tsx`, ohne
  `layout.tsx`s Grundstruktur anzufassen.

- [ ] **Step 1: Test für die Startseite schreiben**

```tsx
// src/app/page.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'

describe('HomePage', () => {
  it('renders the couple names as the main heading', () => {
    render(<HomePage />)
    expect(
      screen.getByRole('heading', { level: 1, name: /saruga.*vinith/i })
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/page.test.tsx`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: Layout, Robots und Startseite implementieren**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Saruga & Vinith',
  description: 'Alles rund um unsere Hochzeit am 17. Oktober 2026.',
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
```

```ts
// src/app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  }
}
```

```tsx
// src/app/page.tsx
export default function HomePage() {
  return (
    <main>
      <h1>Saruga &amp; Vinith</h1>
      <p>Wir heiraten am 17. Oktober 2026.</p>
    </main>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Gesamte Toolchain prüfen, inklusive Produktions-Build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün. Der `build`-Schritt rendert jetzt eine echte Seite
statt nur die API-Route aus Task 1.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/robots.ts src/app/page.tsx \
  src/app/page.test.tsx
git commit -m "Add root layout, robots.txt and placeholder home page"
```

---

## Task 8: Docker, Caddy, Autoheal

**Files:**
- Create: `Dockerfile`
- Create: `docker-entrypoint.sh`
- Create: `docker-compose.yml`
- Create: `Caddyfile`

**Interfaces:**
- Consumes: `npm run build`-Output (`.next/standalone`) aus allen
  vorherigen Tasks, `/api/health` aus Task 1 als `HEALTHCHECK`-Ziel.
- Produces: ein lauffähiges Docker-Image, auf das spätere Pläne nichts
  Strukturelles mehr ändern müssen (`COPY . .` erfasst neue Dateien
  automatisch).

- [ ] **Step 1: `Dockerfile` anlegen**

```dockerfile
# syntax=docker/dockerfile:1

FROM node:24-alpine AS base

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Runtime ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && apk add --no-cache su-exec

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY docker-entrypoint.sh ./

RUN mkdir -p ./data \
    && chown -R nextjs:nodejs ./data \
    && chmod +x ./docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

- [ ] **Step 2: `docker-entrypoint.sh` anlegen**

```sh
#!/bin/sh
set -e

# Laeuft als root beim Containerstart. Das gemountete ./data-Verzeichnis
# kann je nach Erzeugung auf dem Host anders als uid 1001 gehoeren - das
# wuerde Schreibzugriffe vom unprivilegierten "nextjs"-Nutzer fehlschlagen
# lassen. Rechte bei jedem Start korrigieren, dann zu "nextjs" wechseln.
mkdir -p ./data
chown -R nextjs:nodejs ./data

exec su-exec nextjs "$@"
```

- [ ] **Step 3: `docker-compose.yml` anlegen**

```yaml
services:
  web:
    build: .
    image: ghcr.io/kowrithv/saru_vinith_wedding:${IMAGE_TAG:-develop}
    container_name: saru-vinith-wedding
    restart: unless-stopped
    expose:
      - "3000"
    env_file:
      - path: .env.production
        required: false
    volumes:
      - ./data:/app/data
    labels:
      - "autoheal=true"
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
      interval: 30s
      timeout: 5s
      start_period: 20s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
    deploy:
      resources:
        limits:
          memory: 1500M

  caddy:
    image: caddy:2.9-alpine
    container_name: saru-vinith-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      - DOMAIN=${DOMAIN:-localhost}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web

  autoheal:
    image: willfarrell/autoheal:latest
    container_name: saru-vinith-autoheal
    restart: unless-stopped
    environment:
      AUTOHEAL_CONTAINER_LABEL: autoheal
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

volumes:
  caddy_data:
  caddy_config:
```

- [ ] **Step 4: `Caddyfile` anlegen**

```
{$DOMAIN:localhost} {
	reverse_proxy web:3000
}
```

Hinweis: `DOMAIN` ist noch nicht final (offener Punkt aus der Spec). Ohne
gesetzte Variable fällt Caddy auf `localhost` zurück (kein TLS-Versuch,
funktioniert lokal). Auf dem Server wird `DOMAIN=<echte-domain>` in
`.env.production` gesetzt, sobald die Domain feststeht — Caddy holt dann
automatisch ein Let's-Encrypt-Zertifikat.

- [ ] **Step 5: Compose-Syntax validieren**

Run: `docker compose config`
Expected: gibt die aufgelöste Konfiguration ohne Fehler aus.

- [ ] **Step 6: Image bauen und Health-Endpoint gegen den Container prüfen**

Run:
```bash
docker build -t saru-vinith-wedding:test .
docker run --rm -d --name saru-test -p 3100:3000 \
  -e ADMIN_PASSWORD=test-password \
  saru-vinith-wedding:test
sleep 2
curl -sf http://localhost:3100/api/health
docker stop saru-test
```
Expected: Build läuft durch, `curl` liefert `{"ok":true}`, Container stoppt
sauber.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile docker-entrypoint.sh docker-compose.yml Caddyfile
git commit -m "Add Docker image, Caddy reverse proxy and autoheal setup"
```

---

## Task 9: CI/CD-Workflows

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/docker-build.yml`

**Interfaces:**
- Consumes: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
  (Task 1), das Dockerfile (Task 8).
- Produces: GHCR-Images getaggt mit Branch-Namen (`develop`, `main`) und
  Versions-Tags, nur nachdem `ci.yml` erfolgreich war.

- [ ] **Step 1: `ci.yml` anlegen**

```yaml
name: CI

on:
  push:
    branches-ignore:
      - gh-pages
  pull_request:
  workflow_dispatch:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: Lint, Typecheck, Test & Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
        env:
          NEXT_TELEMETRY_DISABLED: '1'
```

- [ ] **Step 2: `docker-build.yml` anlegen, gegated auf ein grünes `ci.yml`**

```yaml
name: Build and push Docker image

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [develop, main]
  push:
    tags: ["v*.*.*"]
  workflow_dispatch: {}

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    if: >
      github.event_name != 'workflow_run' ||
      github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.ref }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (tags, labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha,format=short

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          platforms: linux/amd64
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 3: YAML-Syntax lokal prüfen**

Run: `node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))" 2>&1 || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: kein Fehler (nutzt, was auf der Maschine verfügbar ist — eines
der beiden Tools reicht). Eine vollständige Verifikation erfolgt erst durch
den ersten echten Push, das kann lokal nicht vorweggenommen werden.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/docker-build.yml
git commit -m "Add CI pipeline and CI-gated Docker image publishing"
```

---

## Abschluss

Nach Task 9 ist das Grundgerüst vollständig: `npm run typecheck && npm run
lint && npm test && npm run build` laufen grün, das Docker-Image startet und
beantwortet `/api/health`, Admin-Login funktioniert mit Rate-Limiting und
sicherem Cookie. Der nächste Plan (Story/Info/FAQ oder Quiz, je nach
Priorität) baut direkt darauf auf — `getDb()`, `RateLimiter`,
`ADMIN_COOKIE_NAME`/`verifyCookieValue` stehen als fertige Bausteine zur
Verfügung.
