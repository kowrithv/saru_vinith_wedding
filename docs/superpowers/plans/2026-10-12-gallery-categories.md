# Galerie-Kategorien & offizielle Fotos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erweitert das bereits gebaute Galerie-Backend um eine feste
Kategorie-Liste (Gast wählt beim Hochladen eine Kategorie für den ganzen
Batch) und einen `isOfficial`-Status für admin-hochgeladene, kuratierte
Fotos — beides über dieselbe `gallery_photos`-Tabelle und R2-Pipeline wie
Gast-Uploads, kein paralleles System.

**Architecture:** Schema-Migration (idempotentes `ALTER TABLE`) fügt zwei
Spalten hinzu. `isOfficial` wird ausschließlich serverseitig aus
`isAdminRequest` abgeleitet und ins bereits bestehende HMAC-signierte
Ticket gebunden — nie aus dem Request-Body gelesen, also vom Client nicht
fälschbar. Ein Admin-Request überspringt die Gast-Kennwort-Prüfung
komplett.

**Tech Stack:** Next.js App Router · better-sqlite3 · Zod · Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-gallery-design.md` (Abschnitt
„Erweiterung (2026-10-12, nachträglich): Kategorien & offizielle Fotos")

## Global Constraints

- Kategorie-Liste fest im Code: `['Kennenlernen', 'Verlobung', 'Hochzeit',
  'Party']` in `src/lib/gallery-categories.ts` — vom Nutzer beim
  Spec-Review bestätigt.
- `category` gilt pro Upload-**Batch**, nicht pro Foto.
- `password` wird im Request-Body optional; ein gültiger Admin-Cookie
  ersetzt die Kennwort-Prüfung vollständig (auch wenn `password` fehlt).
- `isOfficial` kommt **nie** aus dem Request-Body — ausschließlich aus
  `isAdminRequest(request, db)`, serverseitig ins Ticket signiert.
- Schema-Migration per `ALTER TABLE ... ADD COLUMN`, idempotent (prüft via
  `PRAGMA table_info`, ob die Spalte schon existiert, bevor sie sie
  anlegt) — `CREATE TABLE IF NOT EXISTS` allein reicht nicht, weil die
  Tabelle in Produktion schon existieren könnte.
- TDD Pflicht pro Funktion/Route: Test schreiben → rot sehen → minimal
  implementieren → grün.

## Review Focus

- Eine Gast-Anfrage ganz **ohne** `password`-Feld (nicht nur ein falsches)
  muss weiterhin mit 401 abgelehnt werden — jetzt, wo `password` optional
  im Schema ist, darf das Fehlen nicht versehentlich als „kein Kennwort
  nötig" durchgehen.
- `isOfficial` darf sich nicht über den Request-Body setzen lassen, selbst
  wenn ein Client ein `isOfficial: true`-Feld mitschickt — nur ein echter
  Admin-Cookie darf ein Ticket mit `isOfficial: true` erzeugen.
  (Schema hat dieses Feld gar nicht erst, Zod verwirft unbekannte Felder
  by default beim Parsen.)
- Ein unbekannter Kategorie-Wert muss abgelehnt werden (400), nicht
  stillschweigend ignoriert oder als Standardkategorie interpretiert.
- Die Schema-Migration muss idempotent sein — `applySchema` zweimal auf
  derselben Verbindung aufrufen darf nicht mit „duplicate column name"
  fehlschlagen.
- Eine schon vor dieser Migration angelegte `gallery_photos`-Zeile (ohne
  `category`/`is_official`, falls die Tabelle per `ALTER TABLE`
  nachträglich erweitert wurde) muss beim Lesen sinnvolle Defaults
  bekommen (`'Hochzeit'`/`false`), nicht `null`/`undefined`.

---

## Task 1: Schema-Migration & Kategorie-Liste

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/db.test.ts`
- Create: `src/lib/gallery-categories.ts` (kein eigener Test — reine
  statische Liste, gleiche Konvention wie `home-content.ts`/
  `who-game-content.ts`, die auch keine Tests haben)

**Interfaces:**
- Produces: `gallery_photos` bekommt die Spalten `category TEXT NOT NULL
  DEFAULT 'Hochzeit'` und `is_official INTEGER NOT NULL DEFAULT 0`.
  `galleryCategories` (Array), `GalleryCategory` (Union-Type) aus
  `gallery-categories.ts`. Von Task 2 und 3 konsumiert.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```ts
// src/lib/db.test.ts - innerhalb describe('createDb', ...) ergänzen,
// und den Import um applySchema erweitern:
// import { applySchema, createDb, getDb } from './db'

it('creates gallery_photos with category and is_official columns, with correct defaults', () => {
  const db = createDb(':memory:')
  db.prepare(
    `INSERT INTO gallery_photos (id, thumb_key, original_key, uploader_name, delete_token_hash)
     VALUES (?, ?, ?, ?, ?)`
  ).run('p1', 't1', 'o1', 'Anna', 'hash1')

  const row = db
    .prepare('SELECT category, is_official FROM gallery_photos WHERE id = ?')
    .get('p1') as { category: string; is_official: number }

  expect(row.category).toBe('Hochzeit')
  expect(row.is_official).toBe(0)
  db.close()
})

it('applying the schema twice on the same connection does not throw (idempotent migration)', () => {
  const db = createDb(':memory:')
  expect(() => applySchema(db)).not.toThrow()
  db.close()
})

it('migrates an existing gallery_photos table (created before this change) by adding the new columns with working defaults', () => {
  // Baut absichtlich die ALTE Tabellenform von Hand nach (ohne
  // category/is_official), um den ALTER-TABLE-Zweig von applySchema
  // tatsächlich zu durchlaufen - createDb() allein würde das nie tun,
  // weil sein CREATE TABLE die neuen Spalten schon enthält.
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE gallery_photos (
      id TEXT PRIMARY KEY,
      thumb_key TEXT NOT NULL,
      original_key TEXT NOT NULL,
      uploader_name TEXT NOT NULL,
      delete_token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `)
  db.prepare(
    `INSERT INTO gallery_photos (id, thumb_key, original_key, uploader_name, delete_token_hash)
     VALUES (?, ?, ?, ?, ?)`
  ).run('old-photo', 't', 'o', 'Anna', 'hash')

  applySchema(db)

  const row = db
    .prepare('SELECT category, is_official FROM gallery_photos WHERE id = ?')
    .get('old-photo') as { category: string; is_official: number }
  expect(row.category).toBe('Hochzeit')
  expect(row.is_official).toBe(0)
  db.close()
})
```

Für diesen letzten Test zusätzlich importieren: `import Database from
'better-sqlite3'` (Default-Export, nicht der `Database`-Namespace-Typ,
der schon über `createDb`/`applySchema` indirekt im Spiel ist - in
`db.test.ts` bisher noch kein direkter Import nötig gewesen).

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/db.test.ts`
Expected: FAIL — `category`/`is_official` existieren noch nicht in
`gallery_photos` (`SQLITE_ERROR: no such column`), und `applySchema` ist
noch kein benannter Export im Testfile-Import (Importfehler, falls der
Import nicht vorher ergänzt wurde)

- [ ] **Step 3: `db.ts` erweitern**

```ts
// src/lib/db.ts (vollständige neue Fassung)
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return columns.some((col) => col.name === column)
}

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
      category TEXT NOT NULL DEFAULT 'Hochzeit',
      is_official INTEGER NOT NULL DEFAULT 0,
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

  // Migration für gallery_photos-Tabellen, die vor dieser Erweiterung
  // angelegt wurden - CREATE TABLE IF NOT EXISTS legt die neuen Spalten
  // nur bei einer brandneuen Tabelle an. Idempotent, da applySchema bei
  // jedem createDb()-Aufruf erneut läuft.
  if (!columnExists(db, 'gallery_photos', 'category')) {
    db.exec(`ALTER TABLE gallery_photos ADD COLUMN category TEXT NOT NULL DEFAULT 'Hochzeit'`)
  }
  if (!columnExists(db, 'gallery_photos', 'is_official')) {
    db.exec(`ALTER TABLE gallery_photos ADD COLUMN is_official INTEGER NOT NULL DEFAULT 0`)
  }
}

export function createDb(dbPath: string): Database.Database {
  if (dbPath !== ':memory:') {
    mkdirSync(path.dirname(dbPath), { recursive: true })
  }
  const db = new Database(dbPath)
  applySchema(db)
  return db
}

declare global {
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
Expected: PASS (7/7)

- [ ] **Step 5: Kategorie-Liste anlegen**

```ts
// src/lib/gallery-categories.ts
export const galleryCategories = ['Kennenlernen', 'Verlobung', 'Hochzeit', 'Party'] as const

export type GalleryCategory = (typeof galleryCategories)[number]
```

- [ ] **Step 6: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 7: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts src/lib/gallery-categories.ts
git commit -m "Add category/isOfficial columns to gallery_photos"
```

---

## Task 2: Ticket & Datenzugriffsschicht erweitern

**Files:**
- Modify: `src/lib/upload-ticket.ts`
- Modify: `src/lib/upload-ticket.test.ts`
- Modify: `src/lib/gallery-photos.ts`
- Modify: `src/lib/gallery-photos.test.ts`

**Interfaces:**
- Consumes: `galleryCategories`/`GalleryCategory` (Task 1, nicht direkt
  importiert hier, aber die gültigen Werte, die `category: string` tragen
  wird).
- Produces: `TicketPayload` bekommt `category: string`, `isOfficial:
  boolean`. `GalleryPhoto` bekommt `category: string`, `isOfficial:
  boolean`. `addGalleryPhoto`s Parameter-Objekt bekommt `category`,
  `isOfficial` als Pflichtfelder. Von Task 3 konsumiert.

- [ ] **Step 1: Fehlschlagenden Test für `upload-ticket.ts` schreiben**

```ts
// src/lib/upload-ticket.test.ts (vollständige neue Fassung)
import { describe, expect, it } from 'vitest'
import { signUploadTicket, verifyUploadTicket, type TicketPayload } from './upload-ticket'

const samplePayload: TicketPayload = {
  photoId: 'abc-123',
  thumbKey: 'gallery/abc-123/thumb.jpg',
  originalKey: 'gallery/abc-123/original.jpg',
  thumbMaxSize: 2 * 1024 * 1024,
  originalSize: 4_000_000,
  expiresAt: Date.now() + 15 * 60 * 1000,
  category: 'Hochzeit',
  isOfficial: false,
}

describe('upload ticket signing', () => {
  it('round-trips a valid ticket, including category and isOfficial', () => {
    const ticket = signUploadTicket(samplePayload, 'secret')
    expect(verifyUploadTicket(ticket, 'secret')).toEqual(samplePayload)
  })

  it('round-trips an official ticket', () => {
    const officialPayload: TicketPayload = { ...samplePayload, category: 'Verlobung', isOfficial: true }
    const ticket = signUploadTicket(officialPayload, 'secret')
    expect(verifyUploadTicket(ticket, 'secret')).toEqual(officialPayload)
  })

  it('rejects a ticket signed with a different secret', () => {
    const ticket = signUploadTicket(samplePayload, 'secret')
    expect(verifyUploadTicket(ticket, 'other-secret')).toBeNull()
  })

  it('rejects a ticket whose payload was altered after signing', () => {
    const ticket = signUploadTicket(samplePayload, 'secret')
    const signature = ticket.slice(ticket.indexOf('.') + 1)
    const tamperedPayload: TicketPayload = { ...samplePayload, isOfficial: true }
    const tamperedEncoded = Buffer.from(JSON.stringify(tamperedPayload), 'utf8').toString('base64url')

    expect(verifyUploadTicket(`${tamperedEncoded}.${signature}`, 'secret')).toBeNull()
  })

  it('rejects an expired ticket', () => {
    const expired: TicketPayload = { ...samplePayload, expiresAt: Date.now() - 1000 }
    const ticket = signUploadTicket(expired, 'secret')
    expect(verifyUploadTicket(ticket, 'secret')).toBeNull()
  })

  it('rejects a malformed ticket string', () => {
    expect(verifyUploadTicket('not-a-real-ticket', 'secret')).toBeNull()
  })
})
```

Hinweis: der „tampered payload"-Test ändert `isOfficial` statt `originalSize`
wie im Vorgänger-Test — bindet damit explizit, dass eine nachträgliche
Änderung von `isOfficial` ebenfalls erkannt wird (genau das Feld, das in
Task 3 sicherheitsrelevant wird).

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/upload-ticket.test.ts`
Expected: FAIL — TypeScript-Fehler, `category`/`isOfficial` fehlen im
`TicketPayload`-Typ (bzw. laufen als überzählige Objekt-Eigenschaften ins
Leere, bis der Typ erweitert ist)

- [ ] **Step 3: `TicketPayload` erweitern**

```ts
// src/lib/upload-ticket.ts - nur das Interface ändert sich, Signier-/
// Prüflogik bleibt unverändert (sie serialisiert das Payload-Objekt
// bereits generisch als JSON)
export interface TicketPayload {
  photoId: string
  thumbKey: string
  originalKey: string
  thumbMaxSize: number
  originalSize: number
  expiresAt: number
  category: string
  isOfficial: boolean
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/upload-ticket.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Fehlschlagenden Test für `gallery-photos.ts` schreiben**

```ts
// src/lib/gallery-photos.test.ts (vollständige neue Fassung)
import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { addGalleryPhoto, listGalleryPhotos, getGalleryPhotoById, deleteGalleryPhotoRow } from './gallery-photos'

function photoInput(overrides: Partial<Parameters<typeof addGalleryPhoto>[1]> = {}) {
  return {
    id: 'photo-1',
    thumbKey: 't1',
    originalKey: 'o1',
    uploaderName: 'Anna',
    deleteTokenHash: 'h1',
    category: 'Hochzeit',
    isOfficial: false,
    ...overrides,
  }
}

describe('gallery photos', () => {
  it('adds a photo and returns it without the delete-token hash', () => {
    const db = createDb(':memory:')
    const photo = addGalleryPhoto(db, photoInput({
      id: 'photo-1',
      thumbKey: 'gallery/photo-1/thumb.jpg',
      originalKey: 'gallery/photo-1/original.jpg',
    }))
    expect(photo).toEqual({
      id: 'photo-1',
      thumbKey: 'gallery/photo-1/thumb.jpg',
      originalKey: 'gallery/photo-1/original.jpg',
      uploaderName: 'Anna',
      category: 'Hochzeit',
      isOfficial: false,
      createdAt: expect.any(String),
    })
    expect(photo).not.toHaveProperty('deleteTokenHash')
    db.close()
  })

  it('stores and returns isOfficial as a real boolean, not 0/1, and keeps the given category', () => {
    const db = createDb(':memory:')
    const photo = addGalleryPhoto(db, photoInput({ category: 'Party', isOfficial: true }))
    expect(photo.isOfficial).toBe(true)
    expect(photo.category).toBe('Party')
    db.close()
  })

  it('lists photos newest first', () => {
    const db = createDb(':memory:')
    addGalleryPhoto(db, photoInput({ id: 'photo-1' }))
    addGalleryPhoto(db, photoInput({ id: 'photo-2' }))

    expect(listGalleryPhotos(db).map((p) => p.id)).toEqual(['photo-2', 'photo-1'])
    db.close()
  })

  it('getGalleryPhotoById includes the delete-token hash', () => {
    const db = createDb(':memory:')
    addGalleryPhoto(db, photoInput({ deleteTokenHash: 'secret-hash' }))

    expect(getGalleryPhotoById(db, 'photo-1')?.deleteTokenHash).toBe('secret-hash')
    db.close()
  })

  it('getGalleryPhotoById returns undefined for an unknown id', () => {
    const db = createDb(':memory:')
    expect(getGalleryPhotoById(db, 'does-not-exist')).toBeUndefined()
    db.close()
  })

  it('deletes a photo row and reports success', () => {
    const db = createDb(':memory:')
    addGalleryPhoto(db, photoInput())

    expect(deleteGalleryPhotoRow(db, 'photo-1')).toBe(true)
    expect(listGalleryPhotos(db)).toEqual([])
    db.close()
  })

  it('reports failure when deleting an id that does not exist', () => {
    const db = createDb(':memory:')
    expect(deleteGalleryPhotoRow(db, 'does-not-exist')).toBe(false)
    db.close()
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/gallery-photos.test.ts`
Expected: FAIL — TypeScript-Fehler (`category`/`isOfficial` fehlen im
Parameter-Typ von `addGalleryPhoto`) bzw. die neue `isOfficial`/Kategorie-
Zusicherung schlägt fehl

- [ ] **Step 7: `gallery-photos.ts` erweitern**

```ts
// src/lib/gallery-photos.ts (vollständige neue Fassung)
import type Database from 'better-sqlite3'

export interface GalleryPhoto {
  id: string
  thumbKey: string
  originalKey: string
  uploaderName: string
  category: string
  isOfficial: boolean
  createdAt: string
}

interface GalleryPhotoRow {
  id: string
  thumb_key: string
  original_key: string
  uploader_name: string
  delete_token_hash: string
  category: string
  is_official: number
  created_at: string
}

function toPhoto(row: GalleryPhotoRow): GalleryPhoto {
  return {
    id: row.id,
    thumbKey: row.thumb_key,
    originalKey: row.original_key,
    uploaderName: row.uploader_name,
    category: row.category,
    isOfficial: row.is_official === 1,
    createdAt: row.created_at,
  }
}

const SELECT_COLUMNS =
  'id, thumb_key, original_key, uploader_name, delete_token_hash, category, is_official, created_at'

export function addGalleryPhoto(
  db: Database.Database,
  photo: {
    id: string
    thumbKey: string
    originalKey: string
    uploaderName: string
    deleteTokenHash: string
    category: string
    isOfficial: boolean
  }
): GalleryPhoto {
  db.prepare(
    `INSERT INTO gallery_photos (id, thumb_key, original_key, uploader_name, delete_token_hash, category, is_official)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    photo.id,
    photo.thumbKey,
    photo.originalKey,
    photo.uploaderName,
    photo.deleteTokenHash,
    photo.category,
    photo.isOfficial ? 1 : 0
  )
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM gallery_photos WHERE id = ?`)
    .get(photo.id) as GalleryPhotoRow
  return toPhoto(row)
}

export function listGalleryPhotos(db: Database.Database): GalleryPhoto[] {
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM gallery_photos ORDER BY rowid DESC`)
    .all() as GalleryPhotoRow[]
  return rows.map(toPhoto)
}

export function getGalleryPhotoById(
  db: Database.Database,
  id: string
): (GalleryPhoto & { deleteTokenHash: string }) | undefined {
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM gallery_photos WHERE id = ?`)
    .get(id) as GalleryPhotoRow | undefined
  if (!row) return undefined
  return { ...toPhoto(row), deleteTokenHash: row.delete_token_hash }
}

export function deleteGalleryPhotoRow(db: Database.Database, id: string): boolean {
  const result = db.prepare('DELETE FROM gallery_photos WHERE id = ?').run(id)
  return result.changes > 0
}
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/gallery-photos.test.ts`
Expected: PASS (7/7)

- [ ] **Step 9: Die beiden hier geänderten Testdateien isoliert prüfen**

Run: `npx vitest run src/lib/upload-ticket.test.ts src/lib/gallery-photos.test.ts`
Expected: PASS (13/13 zusammen)

**Vorab-Ruling (Cross-Task-Kopplung, bewusst vorab entschieden statt erst
beim Auftreten zu stoppen):** `addGalleryPhoto`s Parameter wird in diesem
Task um zwei Pflichtfelder strenger. `src/app/api/uploads/complete/route.ts`
ruft `addGalleryPhoto` auf und wird dadurch **in Task 2 selbst** nicht mehr
kompilieren, bis Task 3 es anpasst — exakt dieselbe Art von
Cross-Task-Kopplung, die im granular-write-lock-Plan dieses Projekts
(Task 1/2) schon einmal auftrat und dort genauso gelöst wurde. Deshalb:
**`npm run typecheck` (gesamtes Projekt) wird an dieser Stelle absichtlich
NICHT ausgeführt** — das ist kein vergessener Schritt, sondern bewusst auf
Task 3 Step 11 verschoben, wo beide Tasks gemeinsam gegen einen einzigen
grünen Lauf abgeschlossen werden. Commit trotzdem jetzt (Step 10) - der
nächste Task behebt die Typinkompatibilität im direkten Anschluss, bevor
irgendjemand anderes auf diesem Zwischenstand aufbaut.

- [ ] **Step 10: Commit**

```bash
git add src/lib/upload-ticket.ts src/lib/upload-ticket.test.ts \
  src/lib/gallery-photos.ts src/lib/gallery-photos.test.ts
git commit -m "Add category and isOfficial to the upload ticket and gallery photo record"
```

---

## Task 3: Routen aktualisieren (Request, Complete, Anzeige)

**Files:**
- Modify: `src/app/api/uploads/request/route.ts`
- Modify: `src/app/api/uploads/request/route.test.ts`
- Modify: `src/app/api/uploads/complete/route.ts`
- Modify: `src/app/api/uploads/complete/route.test.ts`
- Modify: `src/app/api/gallery/route.test.ts` (keine Produktionscode-
  Änderung nötig — `GET` reicht `listGalleryPhotos`s Ergebnis unverändert
  durch, aber der neue Vertrag für das Frontend wird hier fest
  zugesichert)

**Interfaces:**
- Consumes: `galleryCategories` (Task 1), erweiterte `TicketPayload`,
  `addGalleryPhoto`-Signatur (Task 2), `isAdminRequest` (bestehend,
  `admin-auth.ts`).
- Produces: `POST /api/uploads/request` akzeptiert `category` (Pflicht)
  und optionales `password`; überspringt die Kennwort-Prüfung bei
  gültigem Admin-Cookie und bindet `isOfficial` serverseitig ins Ticket.
  `POST /api/uploads/complete` übernimmt `category`/`isOfficial` aus dem
  Ticket in die DB-Zeile. `GET /api/gallery` liefert `category`/
  `isOfficial` auf jedem Foto-Objekt. Vom Galerie-Frontend-Folgeplan
  konsumiert.

- [ ] **Step 1: Fehlschlagenden Test für `/api/uploads/request` schreiben**

```ts
// src/app/api/uploads/request/route.test.ts (vollständige neue Fassung)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { getDb } from '@/lib/db'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'
import { verifyUploadTicket } from '@/lib/upload-ticket'

vi.mock('@/lib/r2', () => ({
  createPresignedPutUrl: vi.fn(async (key: string) => `https://r2.example/${key}?signed`),
}))

function requestBody(body: unknown, cookieValue?: string): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (cookieValue !== undefined) {
    headers.set('cookie', `${ADMIN_COOKIE_NAME}=${cookieValue}`)
  }
  return new Request('http://localhost/api/uploads/request', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/uploads/request', () => {
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

  it('rejects the wrong password without issuing any ticket', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'falsch',
        category: 'Hochzeit',
        files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }],
      })
    )
    expect(response.status).toBe(401)
  })

  it('rejects a guest request with no password field at all', async () => {
    getDb()
    const response = await POST(
      requestBody({
        category: 'Hochzeit',
        files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }],
      })
    )
    expect(response.status).toBe(401)
  })

  it('issues tickets marked not official for a guest with the correct password', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Hochzeit',
        files: [
          { filename: 'a.jpg', size: 1_000_000, contentType: 'image/jpeg' },
          { filename: 'b.png', size: 2_000_000, contentType: 'image/png' },
        ],
      })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.tickets).toHaveLength(2)
    expect(body.tickets[0]).toMatchObject({
      thumbKey: expect.stringContaining('/thumb.jpg'),
      originalKey: expect.stringContaining('/original.jpg'),
    })
    expect(body.tickets[1].originalKey).toContain('/original.png')

    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const payload = verifyUploadTicket(body.tickets[0].ticket, secret)
    expect(payload?.isOfficial).toBe(false)
    expect(payload?.category).toBe('Hochzeit')
  })

  it('issues an official ticket without any password when the request has a valid admin cookie', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await POST(
      requestBody(
        { category: 'Verlobung', files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }] },
        cookieValue
      )
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    const payload = verifyUploadTicket(body.tickets[0].ticket, secret)
    expect(payload?.isOfficial).toBe(true)
    expect(payload?.category).toBe('Verlobung')
  })

  it('ignores a client-supplied isOfficial field for a guest request', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Hochzeit',
        isOfficial: true,
        files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }],
      })
    )
    const body = await response.json()
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const payload = verifyUploadTicket(body.tickets[0].ticket, secret)
    expect(payload?.isOfficial).toBe(false)
  })

  it('rejects an unknown category value', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Geburtstag',
        files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }],
      })
    )
    expect(response.status).toBe(400)
  })

  it('rejects an unknown content type before issuing any ticket', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Hochzeit',
        files: [{ filename: 'a.mov', size: 1000, contentType: 'video/quicktime' }],
      })
    )
    expect(response.status).toBe(400)
  })

  it('rejects a content type that collides with an Object prototype property', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Hochzeit',
        files: [{ filename: 'a.jpg', size: 1000, contentType: 'constructor' }],
      })
    )
    expect(response.status).toBe(400)
  })

  it('rejects a file declared larger than the size cap', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        category: 'Hochzeit',
        files: [{ filename: 'a.jpg', size: 21 * 1024 * 1024, contentType: 'image/jpeg' }],
      })
    )
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/uploads/request/route.test.ts`
Expected: FAIL — `category` fehlt noch im Body-Schema (400 statt der
jeweils erwarteten Statuscodes), `isAdminRequest`-Zweig existiert noch
nicht

- [ ] **Step 3: `/api/uploads/request` anpassen**

```ts
// src/app/api/uploads/request/route.ts (vollständige neue Fassung)
import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { verifyPassword, getOrCreateAdminSecret, isAdminRequest } from '@/lib/admin-auth'
import { createPresignedPutUrl } from '@/lib/r2'
import { signUploadTicket } from '@/lib/upload-ticket'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'
import { galleryCategories } from '@/lib/gallery-categories'

const CONTENT_TYPE_EXTENSIONS = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
])

const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024
const MAX_THUMB_BYTES = 2 * 1024 * 1024
const TICKET_DURATION_MS = 15 * 60 * 1000

const fileSchema = z.object({
  filename: z.string().min(1).max(200),
  size: z.number().int().positive(),
  contentType: z.string(),
})

const bodySchema = z.object({
  password: z.string().min(1).max(200).optional(),
  category: z.enum(galleryCategories),
  files: z.array(fileSchema).min(1).max(20),
})

const uploadsLimiter = new RateLimiter({ maxAttempts: 30, windowMs: 15 * 60 * 1000 })

export async function POST(request: Request): Promise<Response> {
  const clientKey = getClientKey(request)
  const limit = uploadsLimiter.check(clientKey)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const db = getDb()
  const isOfficial = isAdminRequest(request, db)

  if (!isOfficial) {
    const uploadPassword = process.env.UPLOAD_PASSWORD_EMPFANG
    if (!parsed.data.password || !uploadPassword || !verifyPassword(parsed.data.password, uploadPassword)) {
      return NextResponse.json({ error: 'Falsches Kennwort.' }, { status: 401 })
    }
  }

  for (const file of parsed.data.files) {
    if (!CONTENT_TYPE_EXTENSIONS.has(file.contentType)) {
      return NextResponse.json({ error: `Dateityp nicht erlaubt: ${file.contentType}` }, { status: 400 })
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      return NextResponse.json({ error: 'Foto ist zu groß (max. 20 MB).' }, { status: 400 })
    }
  }

  const secret = getOrCreateAdminSecret(db)
  const tickets = await Promise.all(
    parsed.data.files.map(async (file) => {
      const extension = CONTENT_TYPE_EXTENSIONS.get(file.contentType) as string
      const photoId = randomUUID()
      const thumbKey = `gallery/${photoId}/thumb.jpg`
      const originalKey = `gallery/${photoId}/original.${extension}`
      const expiresAt = Date.now() + TICKET_DURATION_MS

      const [thumbPutUrl, originalPutUrl] = await Promise.all([
        createPresignedPutUrl(thumbKey, 'image/jpeg'),
        createPresignedPutUrl(originalKey, file.contentType, file.size),
      ])

      const ticket = signUploadTicket(
        {
          photoId,
          thumbKey,
          originalKey,
          thumbMaxSize: MAX_THUMB_BYTES,
          originalSize: file.size,
          expiresAt,
          category: parsed.data.category,
          isOfficial,
        },
        secret
      )

      return { photoId, thumbKey, originalKey, thumbPutUrl, originalPutUrl, ticket, expiresAt }
    })
  )

  return NextResponse.json({ tickets })
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/uploads/request/route.test.ts`
Expected: PASS (9/9)

- [ ] **Step 5: Fehlschlagenden Test für `/api/uploads/complete` schreiben**

```ts
// src/app/api/uploads/complete/route.test.ts - validPayload() und ein
// neuer Test ergänzen (Rest der Datei unverändert):

function validPayload(): TicketPayload {
  return {
    photoId: 'photo-1',
    thumbKey: 'gallery/photo-1/thumb.jpg',
    originalKey: 'gallery/photo-1/original.jpg',
    thumbMaxSize: 2 * 1024 * 1024,
    originalSize: 4_000_000,
    expiresAt: Date.now() + 60_000,
    category: 'Hochzeit',
    isOfficial: false,
  }
}

// Neuer Test, ergänzt in der describe('POST /api/uploads/complete', ...)-Gruppe:
it('persists the category and isOfficial flag from the ticket onto the created photo', async () => {
  const db = getDb()
  const secret = getOrCreateAdminSecret(db)
  const ticket = signUploadTicket({ ...validPayload(), category: 'Verlobung', isOfficial: true }, secret)
  mockHeadObject.mockImplementation(async (key: string) =>
    key.includes('thumb') ? { size: 100_000 } : { size: 4_000_000 }
  )

  const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
  const body = await response.json()
  expect(body.photo.category).toBe('Verlobung')
  expect(body.photo.isOfficial).toBe(true)
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/uploads/complete/route.test.ts`
Expected: FAIL — `addGalleryPhoto`-Aufruf in der Route übergibt noch kein
`category`/`isOfficial` (TypeScript-Fehler) bzw. die neue Zusicherung
schlägt fehl

- [ ] **Step 7: `/api/uploads/complete` anpassen**

```ts
// src/app/api/uploads/complete/route.ts - nur der addGalleryPhoto-Aufruf
// ändert sich, Rest der Datei unverändert:
  const photo = addGalleryPhoto(db, {
    id: payload.photoId,
    thumbKey: payload.thumbKey,
    originalKey: payload.originalKey,
    uploaderName: parsed.data.uploaderName,
    deleteTokenHash,
    category: payload.category,
    isOfficial: payload.isOfficial,
  })
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/uploads/complete/route.test.ts`
Expected: PASS (6/6)

- [ ] **Step 9: Vertrag für `GET /api/gallery` fest zusichern**

```ts
// src/app/api/gallery/route.test.ts - neuer Test, ergänzt in der
// describe('GET /api/gallery', ...)-Gruppe (Rest der Datei unverändert):
it('includes category and isOfficial on each returned photo', async () => {
  const db = getDb()
  addGalleryPhoto(db, {
    id: 'p1',
    thumbKey: 't1',
    originalKey: 'o1',
    uploaderName: 'Anna',
    deleteTokenHash: 'h1',
    category: 'Verlobung',
    isOfficial: true,
  })

  const body = await (await GET(requestWithCookies({}))).json()
  expect(body.photos[0]).toMatchObject({ category: 'Verlobung', isOfficial: true })
})
```

- [ ] **Step 10: Test laufen lassen**

Run: `npx vitest run src/app/api/gallery/route.test.ts`
Expected: PASS (5/5) direkt beim ersten Lauf — `GET` reicht
`listGalleryPhotos`s Objekte unverändert durch, Task 2 hat die Felder
dort schon ergänzt; dieser Schritt fügt nur die feste Zusicherung hinzu,
ohne eigene RED-Phase.

- [ ] **Step 11: Gesamte Toolchain inklusive Build prüfen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün

- [ ] **Step 12: Commit**

```bash
git add src/app/api/uploads/request/route.ts src/app/api/uploads/request/route.test.ts \
  src/app/api/uploads/complete/route.ts src/app/api/uploads/complete/route.test.ts \
  src/app/api/gallery/route.test.ts
git commit -m "Add categories and official-photo support to the upload routes"
```

---

## Abschluss

Nach Task 3 unterstützt die Galerie-Pipeline Kategorien (fest im Code,
pro Upload-Batch gewählt) und admin-kuratierte „offizielle" Fotos über
denselben Upload-Weg wie Gast-Uploads, unterschieden durch ein
serverseitig abgeleitetes, nie vom Client beeinflussbares `isOfficial`-
Flag. Das Galerie-Frontend (Seite mit Kategorie-Filtern, Upload-UI mit
Kategorie-Auswahl, Admin-Upload-Weg ohne Kennwort-Feld) ist ein eigener
Folge-Plan, der auf diesen erweiterten API-Formen aufbaut.
