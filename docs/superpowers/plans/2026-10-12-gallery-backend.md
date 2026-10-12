# Galerie-Backend (R2-Pipeline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baut das komplette R2-Backend der Galerie: Zugriffs-Modus
(öffentlich/Kennwort), die Upload-Pipeline (Ticket-Request, Direkt-Upload-URLs,
Bestätigung), Löschen (Gast-Token oder Admin) inklusive optionalem
Cache-Purge — alles testbar ohne echte R2-Zugangsdaten. Kein Frontend in
diesem Plan (eigener Folge-Plan).

**Architecture:** Ein schmaler R2-Client-Wrapper (`src/lib/r2.ts`) ist der
einzige Code, der tatsächlich mit dem AWS-SDK/R2 spricht; alle Routen
importieren nur seine Funktionen und werden in Tests über
`vi.mock('@/lib/r2')` von echtem R2 entkoppelt. Ein HMAC-signiertes Ticket
bindet Upload-Metadaten zustandslos zwischen Request und Complete, ohne eine
eigene Pending-Uploads-Tabelle. Zwei neue, unabhängige Auth-Konzepte
(Galerie-Kennwort-Cookie, Gast-Lösch-Token) nutzen dieselben kryptographischen
Primitiven wie der bestehende Admin-Login, ohne sie zu duplizieren.

**Tech Stack:** Next.js App Router · `@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner` (R2, S3-kompatibel) · better-sqlite3
(bestehendes Schema, keine Migration nötig) · Zod · Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-gallery-design.md` (und der
R2-Abschnitt in `docs/superpowers/specs/2026-10-11-rewrite-design.md`)

## Global Constraints

- Neue Pflicht-Env-Variablen: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL` — kommen zu
  `REQUIRED_KEYS` in `src/lib/env.ts`, mit Platzhaltern in `.env.local`,
  `.env.example`, `.github/workflows/ci.yml` (gleiches Muster wie
  `UPLOAD_PASSWORD_EMPFANG`).
- `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` sind **nicht** Pflicht — fehlen
  sie, wird der Cache-Purge übersprungen, nie ein Fehler.
- Presigned-URL-Ablauf: 15 Minuten. Original-Größenlimit: 20 MB.
  Thumbnail-Größenlimit: 2 MB. Erlaubte `contentType`s: `image/jpeg`,
  `image/png`, `image/webp`, `image/heic`, `image/heif`.
- `gallery_mode` Default (keine Zeile in `app_config`): `'public'`.
- `gallery_session`-Cookie: 7 Tage gültig (länger als der 12h-Admin-Cookie).
- Rate-Limits: `/api/gallery/unlock` 5 Versuche/15 Min,
  `/api/uploads/request` 30 Versuche/15 Min (geteiltes Venue-WLAN, gleiche
  Begründung wie bei Gästebuch/Erinnerungen).
- `getOrCreateAdminSecret(db)` wird für **beide** neuen HMAC-Zwecke
  wiederverwendet (Galerie-Cookie-Signierung, Ticket-Signierung) — kein neues
  Secret, keine Umbenennung der bestehenden Funktion.
- CORS- und Public-Domain-Konfiguration am R2-Bucket ist **nicht** Teil
  dieses Plans (Cloudflare-Dashboard-Einstellung, mit dem Nutzer bereits
  besprochen).
- TDD Pflicht pro Funktion/Route: Test schreiben → rot sehen → minimal
  implementieren → grün.
- Exakte Versionen pinnen (`--save-exact`), keine `^`/`~`-Ranges, passend zum
  Rest von `package.json`.

## Review Focus

- Ein nach dem Signieren verändertes Ticket (z. B. eine andere Dateigröße
  eingetragen) muss abgelehnt werden, nicht nur ein komplett kaputtes.
- `/api/uploads/complete` muss die **tatsächliche** Objekt-Größe in R2
  (`HeadObject`) gegen das Ticket prüfen — ein Ticket allein darf nicht
  reichen, falls der tatsächlich hochgeladene Inhalt nicht passt.
- Der Gast-Lösch-Token eines Fotos darf kein anderes Foto löschen können
  (jeder Token ist an genau eine `delete_token_hash`-Zeile gebunden).
- Admin muss Fotos auch bei `gallery_mode: 'password'` sehen und löschen
  können, ganz ohne eigenen `gallery_session`-Cookie — die beiden
  Auth-Mechanismen dürfen sich nicht gegenseitig blockieren.
- Ein fehlender oder zur Laufzeit fehlschlagender Cloudflare-Cache-Purge darf
  das eigentliche Löschen (R2-Objekte + DB-Zeile) nnever verhindern — Purge
  ist strikt best-effort.

---

## Task 1: R2-Client-Wrapper & Upload-Ticket-Signierung

**Files:**
- Create: `src/lib/r2.ts`
- Test: `src/lib/r2.test.ts`
- Create: `src/lib/upload-ticket.ts`
- Test: `src/lib/upload-ticket.test.ts`
- Modify: `src/lib/env.ts`
- Modify: `src/lib/env.test.ts`
- Modify: `.env.local`, `.env.example`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces (von späteren Tasks konsumiert): `createPresignedPutUrl(key:
  string, contentType: string, contentLength?: number): Promise<string>`,
  `headObject(key: string): Promise<{size: number} | null>`,
  `deleteObjects(keys: string[]): Promise<void>` aus `r2.ts`.
  `TicketPayload` (Felder: `photoId: string`, `thumbKey: string`,
  `originalKey: string`, `thumbMaxSize: number`, `originalSize: number`,
  `expiresAt: number`), `signUploadTicket(payload: TicketPayload, secret:
  string): string`, `verifyUploadTicket(ticket: string, secret: string, now?:
  number): TicketPayload | null` aus `upload-ticket.ts`.

- [ ] **Step 1: Abhängigkeiten installieren**

```bash
npm install --save-exact @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Fehlschlagenden Test für `r2.ts` schreiben**

```ts
// src/lib/r2.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createPresignedPutUrl, headObject, deleteObjects } from './r2'

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn((input: unknown) => ({ input })),
  HeadObjectCommand: vi.fn((input: unknown) => ({ input })),
  DeleteObjectsCommand: vi.fn((input: unknown) => ({ input })),
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}))

const mockSend = vi.fn()

beforeEach(() => {
  process.env.R2_ACCOUNT_ID = 'test-account'
  process.env.R2_ACCESS_KEY_ID = 'test-key'
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
  process.env.R2_BUCKET_NAME = 'test-bucket'
  vi.mocked(S3Client).mockImplementation(() => ({ send: mockSend }) as unknown as S3Client)
  mockSend.mockReset()
  vi.mocked(getSignedUrl).mockReset()
})

describe('createPresignedPutUrl', () => {
  it('signs a PUT command with the given key, content type and length', async () => {
    vi.mocked(getSignedUrl).mockResolvedValue('https://r2.example/signed-put')

    const url = await createPresignedPutUrl('gallery/abc/original.jpg', 'image/jpeg', 12345)

    expect(url).toBe('https://r2.example/signed-put')
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'gallery/abc/original.jpg',
      ContentType: 'image/jpeg',
      ContentLength: 12345,
    })
  })

  it('omits ContentLength when none is given (thumbnail: size unknown until the browser compresses it)', async () => {
    vi.mocked(getSignedUrl).mockResolvedValue('https://r2.example/signed-put')

    await createPresignedPutUrl('gallery/abc/thumb.jpg', 'image/jpeg')

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'gallery/abc/thumb.jpg',
      ContentType: 'image/jpeg',
    })
  })
})

describe('headObject', () => {
  it('returns the object size when it exists', async () => {
    mockSend.mockResolvedValue({ ContentLength: 999 })

    const result = await headObject('gallery/abc/original.jpg')

    expect(result).toEqual({ size: 999 })
    expect(HeadObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'gallery/abc/original.jpg',
    })
  })

  it('returns null when the object does not exist', async () => {
    mockSend.mockRejectedValue(new Error('NotFound'))

    const result = await headObject('gallery/missing/original.jpg')

    expect(result).toBeNull()
  })
})

describe('deleteObjects', () => {
  it('deletes all given keys in one request', async () => {
    mockSend.mockResolvedValue({})

    await deleteObjects(['gallery/abc/thumb.jpg', 'gallery/abc/original.jpg'])

    expect(DeleteObjectsCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Delete: { Objects: [{ Key: 'gallery/abc/thumb.jpg' }, { Key: 'gallery/abc/original.jpg' }] },
    })
  })

  it('does nothing when given an empty list', async () => {
    await deleteObjects([])
    expect(mockSend).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/r2.test.ts`
Expected: FAIL — `Failed to resolve import "./r2"` (Datei existiert noch
nicht)

- [ ] **Step 4: `r2.ts` implementieren**

```ts
// src/lib/r2.ts
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let client: S3Client | undefined

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    })
  }
  return client
}

export async function createPresignedPutUrl(
  key: string,
  contentType: string,
  contentLength?: number
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
  })
  return getSignedUrl(getClient(), command, { expiresIn: 15 * 60 })
}

export interface HeadObjectResult {
  size: number
}

export async function headObject(key: string): Promise<HeadObjectResult | null> {
  try {
    const result = await getClient().send(
      new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key })
    )
    return { size: result.ContentLength ?? 0 }
  } catch {
    return null
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await getClient().send(
    new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    })
  )
}
```

- [ ] **Step 5: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/r2.test.ts`
Expected: PASS (6/6)

- [ ] **Step 6: Fehlschlagenden Test für `upload-ticket.ts` schreiben**

```ts
// src/lib/upload-ticket.test.ts
import { describe, expect, it } from 'vitest'
import { signUploadTicket, verifyUploadTicket, type TicketPayload } from './upload-ticket'

const samplePayload: TicketPayload = {
  photoId: 'abc-123',
  thumbKey: 'gallery/abc-123/thumb.jpg',
  originalKey: 'gallery/abc-123/original.jpg',
  thumbMaxSize: 2 * 1024 * 1024,
  originalSize: 4_000_000,
  expiresAt: Date.now() + 15 * 60 * 1000,
}

describe('upload ticket signing', () => {
  it('round-trips a valid ticket', () => {
    const ticket = signUploadTicket(samplePayload, 'secret')
    expect(verifyUploadTicket(ticket, 'secret')).toEqual(samplePayload)
  })

  it('rejects a ticket signed with a different secret', () => {
    const ticket = signUploadTicket(samplePayload, 'secret')
    expect(verifyUploadTicket(ticket, 'other-secret')).toBeNull()
  })

  it('rejects a ticket whose payload was altered after signing', () => {
    const ticket = signUploadTicket(samplePayload, 'secret')
    const signature = ticket.slice(ticket.indexOf('.') + 1)
    const tamperedPayload: TicketPayload = { ...samplePayload, originalSize: 999_999_999 }
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

- [ ] **Step 7: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/upload-ticket.test.ts`
Expected: FAIL — `Failed to resolve import "./upload-ticket"`

- [ ] **Step 8: `upload-ticket.ts` implementieren**

```ts
// src/lib/upload-ticket.ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface TicketPayload {
  photoId: string
  thumbKey: string
  originalKey: string
  thumbMaxSize: number
  originalSize: number
  expiresAt: number
}

export function signUploadTicket(payload: TicketPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', secret).update(encoded).digest('hex')
  return `${encoded}.${signature}`
}

export function verifyUploadTicket(
  ticket: string,
  secret: string,
  now: number = Date.now()
): TicketPayload | null {
  const separatorIndex = ticket.indexOf('.')
  if (separatorIndex === -1) return null

  const encoded = ticket.slice(0, separatorIndex)
  const signature = ticket.slice(separatorIndex + 1)

  const expectedSignature = createHmac('sha256', secret).update(encoded).digest('hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  let actualBuffer: Buffer
  try {
    actualBuffer = Buffer.from(signature, 'hex')
  } catch {
    return null
  }
  if (expectedBuffer.length !== actualBuffer.length) return null
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TicketPayload
    if (payload.expiresAt <= now) return null
    return payload
  } catch {
    return null
  }
}
```

- [ ] **Step 9: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/upload-ticket.test.ts`
Expected: PASS (5/5)

- [ ] **Step 10: Fehlschlagenden Test für die erweiterten Env-Checks schreiben**

```ts
// src/lib/env.test.ts (vollständige neue Fassung)
import { describe, expect, it } from 'vitest'
import { MissingEnvError, validateEnv } from './env'

const allSet = {
  ADMIN_PASSWORD: 'secret',
  UPLOAD_PASSWORD_EMPFANG: 'empfang-secret',
  R2_ACCOUNT_ID: 'acc',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secretkey',
  R2_BUCKET_NAME: 'bucket',
  R2_PUBLIC_BASE_URL: 'https://fotos.example.de',
}

describe('validateEnv', () => {
  it('returns the parsed env when every required variable is set', () => {
    expect(validateEnv(allSet)).toEqual({
      adminPassword: 'secret',
      uploadPasswordEmpfang: 'empfang-secret',
      r2AccountId: 'acc',
      r2AccessKeyId: 'key',
      r2SecretAccessKey: 'secretkey',
      r2BucketName: 'bucket',
      r2PublicBaseUrl: 'https://fotos.example.de',
    })
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
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET_NAME',
        'R2_PUBLIC_BASE_URL',
      ])
    }
  })

  it('requires each R2 variable individually', () => {
    for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_BASE_URL']) {
      const partial = { ...allSet, [key]: undefined }
      expect(() => validateEnv(partial)).toThrow(new RegExp(key))
    }
  })

  it('still requires ADMIN_PASSWORD and UPLOAD_PASSWORD_EMPFANG', () => {
    expect(() => validateEnv({ ...allSet, ADMIN_PASSWORD: undefined })).toThrow(/ADMIN_PASSWORD/)
    expect(() => validateEnv({ ...allSet, UPLOAD_PASSWORD_EMPFANG: undefined })).toThrow(/UPLOAD_PASSWORD_EMPFANG/)
  })
})
```

- [ ] **Step 11: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/env.test.ts`
Expected: FAIL — die alten Tests erwarten nur 2 Keys, `allSet` hat 7 Felder,
die `AppEnv`-Rückgabe hat die neuen Felder noch nicht

- [ ] **Step 12: `env.ts` erweitern**

```ts
// src/lib/env.ts (vollständige neue Fassung)
const REQUIRED_KEYS = [
  'ADMIN_PASSWORD',
  'UPLOAD_PASSWORD_EMPFANG',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_BASE_URL',
] as const

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
  r2AccountId: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2BucketName: string
  r2PublicBaseUrl: string
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
    r2AccountId: source.R2_ACCOUNT_ID as string,
    r2AccessKeyId: source.R2_ACCESS_KEY_ID as string,
    r2SecretAccessKey: source.R2_SECRET_ACCESS_KEY as string,
    r2BucketName: source.R2_BUCKET_NAME as string,
    r2PublicBaseUrl: source.R2_PUBLIC_BASE_URL as string,
  }
}
```

- [ ] **Step 13: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/env.test.ts`
Expected: PASS (4/4)

- [ ] **Step 14: Platzhalter in `.env.local`, `.env.example` und CI ergänzen**

`.env.local` (anhängen):
```
R2_ACCOUNT_ID=dev-local-only
R2_ACCESS_KEY_ID=dev-local-only
R2_SECRET_ACCESS_KEY=dev-local-only
R2_BUCKET_NAME=dev-local-only
R2_PUBLIC_BASE_URL=http://localhost:3000/dev-local-only
```

`.env.example` (anhängen, nach `UPLOAD_PASSWORD_EMPFANG=`):
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
# Optional - Cache-Purge beim Löschen wird ohne diese Werte einfach übersprungen
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
```

`.github/workflows/ci.yml` (im `build`-Job, Abschnitt `Build` → `env:`,
nach `UPLOAD_PASSWORD_EMPFANG: ci-build-only`):
```yaml
          R2_ACCOUNT_ID: ci-build-only
          R2_ACCESS_KEY_ID: ci-build-only
          R2_SECRET_ACCESS_KEY: ci-build-only
          R2_BUCKET_NAME: ci-build-only
          R2_PUBLIC_BASE_URL: https://ci-build-only.example.com
```

- [ ] **Step 15: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 16: Commit**

```bash
git add package.json package-lock.json src/lib/r2.ts src/lib/r2.test.ts \
  src/lib/upload-ticket.ts src/lib/upload-ticket.test.ts \
  src/lib/env.ts src/lib/env.test.ts \
  .env.local .env.example .github/workflows/ci.yml
git commit -m "Add R2 client wrapper and upload ticket signing"
```

---

## Task 2: Galerie-Zugriffs-Modus, Datenzugriff & Sichtbarkeits-API

**Files:**
- Create: `src/lib/gallery-mode.ts`
- Test: `src/lib/gallery-mode.test.ts`
- Create: `src/lib/gallery-auth.ts`
- Test: `src/lib/gallery-auth.test.ts`
- Create: `src/lib/gallery-photos.ts`
- Test: `src/lib/gallery-photos.test.ts`
- Create: `src/app/api/gallery/route.ts`
- Test: `src/app/api/gallery/route.test.ts`
- Create: `src/app/api/gallery/unlock/route.ts`
- Test: `src/app/api/gallery/unlock/route.test.ts`

**Interfaces:**
- Consumes: aus Task 1 nichts direkt; aus dem bestehenden Code
  `getOrCreateAdminSecret`, `signCookieValue`, `verifyCookieValue`,
  `verifyPassword`, `isAdminRequest`, `ADMIN_COOKIE_NAME` (`admin-auth.ts`),
  `RateLimiter` (`rate-limit.ts`), `getClientKey` (`client-ip.ts`), `getDb`
  (`db.ts`).
- Produces: `GalleryMode = 'public' | 'password'`, `getGalleryMode(db):
  GalleryMode`, `setGalleryMode(db, mode)` aus `gallery-mode.ts`.
  `GALLERY_COOKIE_NAME`, `GALLERY_SESSION_DURATION_MS`,
  `createGallerySessionCookieValue(db, now?): string`,
  `isGalleryUnlocked(request, db): boolean` aus `gallery-auth.ts`.
  `GalleryPhoto` (Felder: `id: string`, `thumbKey: string`, `originalKey:
  string`, `uploaderName: string`, `createdAt: string`),
  `addGalleryPhoto(db, {id, thumbKey, originalKey, uploaderName,
  deleteTokenHash}): GalleryPhoto`, `listGalleryPhotos(db): GalleryPhoto[]`,
  `getGalleryPhotoById(db, id): (GalleryPhoto & {deleteTokenHash: string}) |
  undefined`, `deleteGalleryPhotoRow(db, id): boolean` aus
  `gallery-photos.ts`. `GET /api/gallery` → `{mode, unlocked, photos}`,
  `POST /api/gallery/unlock` → setzt `gallery_session`-Cookie. Von Task 3, 4
  und 5 sowie dem späteren Frontend-Plan konsumiert.

- [ ] **Step 1: Fehlschlagenden Test für `gallery-mode.ts` schreiben**

```ts
// src/lib/gallery-mode.test.ts
import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { getGalleryMode, setGalleryMode } from './gallery-mode'

describe('gallery mode', () => {
  it('defaults to public when never set', () => {
    const db = createDb(':memory:')
    expect(getGalleryMode(db)).toBe('public')
    db.close()
  })

  it('persists a switch to password', () => {
    const db = createDb(':memory:')
    setGalleryMode(db, 'password')
    expect(getGalleryMode(db)).toBe('password')
    db.close()
  })

  it('can switch back to public', () => {
    const db = createDb(':memory:')
    setGalleryMode(db, 'password')
    setGalleryMode(db, 'public')
    expect(getGalleryMode(db)).toBe('public')
    db.close()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/gallery-mode.test.ts`
Expected: FAIL — `Failed to resolve import "./gallery-mode"`

- [ ] **Step 3: `gallery-mode.ts` implementieren**

```ts
// src/lib/gallery-mode.ts
import type Database from 'better-sqlite3'

export type GalleryMode = 'public' | 'password'

const GALLERY_MODE_KEY = 'gallery_mode'

export function getGalleryMode(db: Database.Database): GalleryMode {
  const row = db
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .get(GALLERY_MODE_KEY) as { value: string } | undefined
  return row?.value === 'password' ? 'password' : 'public'
}

export function setGalleryMode(db: Database.Database, mode: GalleryMode): void {
  db.prepare(
    'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(GALLERY_MODE_KEY, mode)
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/gallery-mode.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Fehlschlagenden Test für `gallery-photos.ts` schreiben**

```ts
// src/lib/gallery-photos.test.ts
import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { addGalleryPhoto, listGalleryPhotos, getGalleryPhotoById, deleteGalleryPhotoRow } from './gallery-photos'

describe('gallery photos', () => {
  it('adds a photo and returns it without the delete-token hash', () => {
    const db = createDb(':memory:')
    const photo = addGalleryPhoto(db, {
      id: 'photo-1',
      thumbKey: 'gallery/photo-1/thumb.jpg',
      originalKey: 'gallery/photo-1/original.jpg',
      uploaderName: 'Anna',
      deleteTokenHash: 'hash-1',
    })
    expect(photo).toEqual({
      id: 'photo-1',
      thumbKey: 'gallery/photo-1/thumb.jpg',
      originalKey: 'gallery/photo-1/original.jpg',
      uploaderName: 'Anna',
      createdAt: expect.any(String),
    })
    expect(photo).not.toHaveProperty('deleteTokenHash')
    db.close()
  })

  it('lists photos newest first', () => {
    const db = createDb(':memory:')
    addGalleryPhoto(db, { id: 'photo-1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1' })
    addGalleryPhoto(db, { id: 'photo-2', thumbKey: 't2', originalKey: 'o2', uploaderName: 'Ben', deleteTokenHash: 'h2' })

    expect(listGalleryPhotos(db).map((p) => p.id)).toEqual(['photo-2', 'photo-1'])
    db.close()
  })

  it('getGalleryPhotoById includes the delete-token hash', () => {
    const db = createDb(':memory:')
    addGalleryPhoto(db, { id: 'photo-1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'secret-hash' })

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
    addGalleryPhoto(db, { id: 'photo-1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1' })

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
Expected: FAIL — `Failed to resolve import "./gallery-photos"`

- [ ] **Step 7: `gallery-photos.ts` implementieren**

```ts
// src/lib/gallery-photos.ts
import type Database from 'better-sqlite3'

export interface GalleryPhoto {
  id: string
  thumbKey: string
  originalKey: string
  uploaderName: string
  createdAt: string
}

interface GalleryPhotoRow {
  id: string
  thumb_key: string
  original_key: string
  uploader_name: string
  delete_token_hash: string
  created_at: string
}

function toPhoto(row: GalleryPhotoRow): GalleryPhoto {
  return {
    id: row.id,
    thumbKey: row.thumb_key,
    originalKey: row.original_key,
    uploaderName: row.uploader_name,
    createdAt: row.created_at,
  }
}

const SELECT_COLUMNS =
  'id, thumb_key, original_key, uploader_name, delete_token_hash, created_at'

export function addGalleryPhoto(
  db: Database.Database,
  photo: { id: string; thumbKey: string; originalKey: string; uploaderName: string; deleteTokenHash: string }
): GalleryPhoto {
  db.prepare(
    `INSERT INTO gallery_photos (id, thumb_key, original_key, uploader_name, delete_token_hash)
     VALUES (?, ?, ?, ?, ?)`
  ).run(photo.id, photo.thumbKey, photo.originalKey, photo.uploaderName, photo.deleteTokenHash)
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM gallery_photos WHERE id = ?`)
    .get(photo.id) as GalleryPhotoRow
  return toPhoto(row)
}

export function listGalleryPhotos(db: Database.Database): GalleryPhoto[] {
  // Sortierung nach `rowid`, nicht `created_at`: `id` ist eine UUID (keine
  // fortlaufende Zahl), zwei schnell aufeinanderfolgende Inserts können
  // denselben Millisekunden-Zeitstempel bekommen. `rowid` ist SQLites
  // interner, garantiert streng aufsteigender Zähler - verhindert
  // Flakiness bei der "neueste zuerst"-Reihenfolge.
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
Expected: PASS (6/6)

- [ ] **Step 9: Fehlschlagenden Test für `gallery-auth.ts` schreiben**

```ts
// src/lib/gallery-auth.test.ts
import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { GALLERY_COOKIE_NAME, createGallerySessionCookieValue, isGalleryUnlocked } from './gallery-auth'

function requestWithCookie(cookieValue?: string): Request {
  const headers = new Headers()
  if (cookieValue !== undefined) {
    headers.set('cookie', `${GALLERY_COOKIE_NAME}=${cookieValue}`)
  }
  return new Request('http://localhost/api/gallery', { headers })
}

describe('gallery session', () => {
  it('is not unlocked without a cookie', () => {
    const db = createDb(':memory:')
    expect(isGalleryUnlocked(requestWithCookie(), db)).toBe(false)
    db.close()
  })

  it('is unlocked with a freshly created session cookie', () => {
    const db = createDb(':memory:')
    const cookieValue = createGallerySessionCookieValue(db)
    expect(isGalleryUnlocked(requestWithCookie(cookieValue), db)).toBe(true)
    db.close()
  })

  it('is not unlocked with a tampered cookie value', () => {
    const db = createDb(':memory:')
    const cookieValue = createGallerySessionCookieValue(db)
    const tampered = cookieValue.slice(0, -1) + (cookieValue.endsWith('a') ? 'b' : 'a')
    expect(isGalleryUnlocked(requestWithCookie(tampered), db)).toBe(false)
    db.close()
  })

  it('is not unlocked with an expired cookie', () => {
    const db = createDb(':memory:')
    const cookieValue = createGallerySessionCookieValue(db, Date.now() - 8 * 24 * 60 * 60 * 1000)
    expect(isGalleryUnlocked(requestWithCookie(cookieValue), db)).toBe(false)
    db.close()
  })
})
```

- [ ] **Step 10: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/gallery-auth.test.ts`
Expected: FAIL — `Failed to resolve import "./gallery-auth"`

- [ ] **Step 11: `gallery-auth.ts` implementieren**

```ts
// src/lib/gallery-auth.ts
import type Database from 'better-sqlite3'
import { getOrCreateAdminSecret, signCookieValue, verifyCookieValue } from './admin-auth'

export const GALLERY_COOKIE_NAME = 'gallery_session'
export const GALLERY_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 Tage

export function createGallerySessionCookieValue(
  db: Database.Database,
  now: number = Date.now()
): string {
  const secret = getOrCreateAdminSecret(db)
  return signCookieValue(now + GALLERY_SESSION_DURATION_MS, secret)
}

export function isGalleryUnlocked(request: Request, db: Database.Database): boolean {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return false

  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GALLERY_COOKIE_NAME}=`))
  if (!match) return false

  const value = match.slice(GALLERY_COOKIE_NAME.length + 1)
  const secret = getOrCreateAdminSecret(db)
  return verifyCookieValue(value, secret)
}
```

- [ ] **Step 12: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/gallery-auth.test.ts`
Expected: PASS (4/4)

- [ ] **Step 13: Fehlschlagenden Test für `GET /api/gallery` schreiben**

```ts
// src/app/api/gallery/route.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from './route'
import { getDb } from '@/lib/db'
import { setGalleryMode } from '@/lib/gallery-mode'
import { addGalleryPhoto } from '@/lib/gallery-photos'
import { createGallerySessionCookieValue, GALLERY_COOKIE_NAME } from '@/lib/gallery-auth'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'

function requestWithCookies(cookies: Record<string, string>): Request {
  const headers = new Headers()
  const cookieHeader = Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ')
  if (cookieHeader) headers.set('cookie', cookieHeader)
  return new Request('http://localhost/api/gallery', { headers })
}

describe('GET /api/gallery', () => {
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

  it('returns photos when the gallery is public, with no cookie at all', async () => {
    const db = getDb()
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1' })

    const body = await (await GET(requestWithCookies({}))).json()
    expect(body.mode).toBe('public')
    expect(body.unlocked).toBe(true)
    expect(body.photos).toHaveLength(1)
  })

  it('hides photos when the mode is password and there is no gallery session', async () => {
    const db = getDb()
    setGalleryMode(db, 'password')
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1' })

    const body = await (await GET(requestWithCookies({}))).json()
    expect(body.mode).toBe('password')
    expect(body.unlocked).toBe(false)
    expect(body.photos).toBeNull()
  })

  it('shows photos when the mode is password and the gallery session cookie is valid', async () => {
    const db = getDb()
    setGalleryMode(db, 'password')
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1' })
    const cookieValue = createGallerySessionCookieValue(db)

    const body = await (await GET(requestWithCookies({ [GALLERY_COOKIE_NAME]: cookieValue }))).json()
    expect(body.unlocked).toBe(true)
    expect(body.photos).toHaveLength(1)
  })

  it('shows photos to an admin even in password mode without a gallery session cookie', async () => {
    const db = getDb()
    setGalleryMode(db, 'password')
    addGalleryPhoto(db, { id: 'p1', thumbKey: 't1', originalKey: 'o1', uploaderName: 'Anna', deleteTokenHash: 'h1' })
    const secret = getOrCreateAdminSecret(db)
    const adminCookie = signCookieValue(Date.now() + 1000, secret)

    const body = await (await GET(requestWithCookies({ [ADMIN_COOKIE_NAME]: adminCookie }))).json()
    expect(body.unlocked).toBe(true)
    expect(body.photos).toHaveLength(1)
  })
})
```

- [ ] **Step 14: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/gallery/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 15: `GET /api/gallery` implementieren**

```ts
// src/app/api/gallery/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { getGalleryMode } from '@/lib/gallery-mode'
import { isGalleryUnlocked } from '@/lib/gallery-auth'
import { listGalleryPhotos } from '@/lib/gallery-photos'

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  const mode = getGalleryMode(db)

  const canSeePhotos = mode === 'public' || isAdminRequest(request, db) || isGalleryUnlocked(request, db)
  if (!canSeePhotos) {
    return NextResponse.json({ mode, unlocked: false, photos: null })
  }

  return NextResponse.json({ mode, unlocked: true, photos: listGalleryPhotos(db) })
}
```

- [ ] **Step 16: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/gallery/route.test.ts`
Expected: PASS (4/4)

- [ ] **Step 17: Fehlschlagenden Test für `POST /api/gallery/unlock` schreiben**

```ts
// src/app/api/gallery/unlock/route.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST } from './route'
import { getDb } from '@/lib/db'
import { GALLERY_COOKIE_NAME } from '@/lib/gallery-auth'

function unlockRequest(password?: string): Request {
  return new Request('http://localhost/api/gallery/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

describe('POST /api/gallery/unlock', () => {
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

  it('sets a gallery session cookie on the correct password', async () => {
    getDb()
    const response = await POST(unlockRequest('empfang-secret'))
    expect(response.status).toBe(200)
    expect(response.cookies.get(GALLERY_COOKIE_NAME)).toBeDefined()
  })

  it('rejects the wrong password without setting a cookie', async () => {
    getDb()
    const response = await POST(unlockRequest('falsch'))
    expect(response.status).toBe(401)
    expect(response.cookies.get(GALLERY_COOKIE_NAME)).toBeUndefined()
  })

  it('rejects the 6th attempt within 15 minutes', async () => {
    getDb()
    for (let i = 0; i < 5; i++) {
      await POST(unlockRequest('falsch'))
    }
    const response = await POST(unlockRequest('falsch'))
    expect(response.status).toBe(429)
  })
})
```

- [ ] **Step 18: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/gallery/unlock/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 19: `POST /api/gallery/unlock` implementieren**

```ts
// src/app/api/gallery/unlock/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { verifyPassword } from '@/lib/admin-auth'
import { createGallerySessionCookieValue, GALLERY_COOKIE_NAME, GALLERY_SESSION_DURATION_MS } from '@/lib/gallery-auth'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'

const bodySchema = z.object({ password: z.string().min(1).max(200) })

const unlockLimiter = new RateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 })

export async function POST(request: Request): Promise<Response> {
  const clientKey = getClientKey(request)
  const limit = unlockLimiter.check(clientKey)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Zu viele Versuche. Bitte später erneut versuchen.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const db = getDb()
  const uploadPassword = process.env.UPLOAD_PASSWORD_EMPFANG
  if (!uploadPassword || !verifyPassword(parsed.data.password, uploadPassword)) {
    return NextResponse.json({ error: 'Falsches Kennwort.' }, { status: 401 })
  }

  const expiresAt = Date.now() + GALLERY_SESSION_DURATION_MS
  const cookieValue = createGallerySessionCookieValue(db)
  const response = NextResponse.json({ success: true })
  response.cookies.set(GALLERY_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  })
  return response
}
```

- [ ] **Step 20: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/gallery/unlock/route.test.ts`
Expected: PASS (3/3)

- [ ] **Step 21: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 22: Commit**

```bash
git add src/lib/gallery-mode.ts src/lib/gallery-mode.test.ts \
  src/lib/gallery-auth.ts src/lib/gallery-auth.test.ts \
  src/lib/gallery-photos.ts src/lib/gallery-photos.test.ts \
  src/app/api/gallery/route.ts src/app/api/gallery/route.test.ts \
  src/app/api/gallery/unlock/route.ts src/app/api/gallery/unlock/route.test.ts
git commit -m "Add gallery view-gate (mode, session, photo list)"
```

---

## Task 3: Admin-API für den Galerie-Modus

**Files:**
- Create: `src/app/api/admin/gallery-mode/route.ts`
- Test: `src/app/api/admin/gallery-mode/route.test.ts`

**Interfaces:**
- Consumes: `getGalleryMode`, `setGalleryMode` (Task 2), `isAdminRequest`
  (bestehend, `admin-auth.ts`).
- Produces: `GET /api/admin/gallery-mode` → `{mode}`,
  `POST /api/admin/gallery-mode` (Body `{mode: 'public'|'password'}`) →
  `{mode}`. Vom späteren Frontend-Plan (Admin-Dashboard) konsumiert.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```ts
// src/app/api/admin/gallery-mode/route.test.ts
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
  return new Request('http://localhost/api/admin/gallery-mode', {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('/api/admin/gallery-mode', () => {
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

  it('GET returns public by default', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await GET(requestWithCookie('GET', cookieValue))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ mode: 'public' })
  })

  it('POST switches the mode and a subsequent GET reflects it', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const postResponse = await POST(requestWithCookie('POST', cookieValue, { mode: 'password' }))
    expect(postResponse.status).toBe(200)
    expect(await postResponse.json()).toEqual({ mode: 'password' })

    const getResponse = await GET(requestWithCookie('GET', cookieValue))
    expect(await getResponse.json()).toEqual({ mode: 'password' })
  })

  it('POST rejects an unknown mode value', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await POST(requestWithCookie('POST', cookieValue, { mode: 'secret-club' }))
    expect(response.status).toBe(400)
  })

  it('POST rejects a request without a valid admin cookie', async () => {
    const response = await POST(requestWithCookie('POST', undefined, { mode: 'password' }))
    expect(response.status).toBe(401)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/admin/gallery-mode/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 3: Route implementieren**

```ts
// src/app/api/admin/gallery-mode/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { getGalleryMode, setGalleryMode } from '@/lib/gallery-mode'

const bodySchema = z.object({ mode: z.enum(['public', 'password']) })

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }
  return NextResponse.json({ mode: getGalleryMode(db) })
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

  setGalleryMode(db, parsed.data.mode)
  return NextResponse.json({ mode: parsed.data.mode })
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/admin/gallery-mode/route.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/gallery-mode/route.ts src/app/api/admin/gallery-mode/route.test.ts
git commit -m "Add admin endpoint to switch the gallery mode"
```

---

## Task 4: Upload-Pipeline (Ticket-Request & Complete)

**Files:**
- Create: `src/app/api/uploads/request/route.ts`
- Test: `src/app/api/uploads/request/route.test.ts`
- Create: `src/app/api/uploads/complete/route.ts`
- Test: `src/app/api/uploads/complete/route.test.ts`

**Interfaces:**
- Consumes: `createPresignedPutUrl`, `headObject` (Task 1, `r2.ts`),
  `signUploadTicket`, `verifyUploadTicket`, `TicketPayload` (Task 1,
  `upload-ticket.ts`), `addGalleryPhoto` (Task 2, `gallery-photos.ts`),
  `verifyPassword`, `getOrCreateAdminSecret` (bestehend), `RateLimiter`,
  `getClientKey` (bestehend).
- Produces: `POST /api/uploads/request` → `{tickets: [{photoId, thumbKey,
  originalKey, thumbPutUrl, originalPutUrl, ticket, expiresAt}, ...]}`.
  `POST /api/uploads/complete` → `{photo: GalleryPhoto, deleteToken: string}`
  (201). Vom späteren Frontend-Plan (Upload-UI) konsumiert.

- [ ] **Step 1: Fehlschlagenden Test für `/api/uploads/request` schreiben**

```ts
// src/app/api/uploads/request/route.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { getDb } from '@/lib/db'

vi.mock('@/lib/r2', () => ({
  createPresignedPutUrl: vi.fn(async (key: string) => `https://r2.example/${key}?signed`),
}))

function requestBody(body: unknown): Request {
  return new Request('http://localhost/api/uploads/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      requestBody({ password: 'falsch', files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }] })
    )
    expect(response.status).toBe(401)
  })

  it('issues one ticket per file with the correct password', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
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
  })

  it('rejects an unknown content type before issuing any ticket', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        files: [{ filename: 'a.mov', size: 1000, contentType: 'video/quicktime' }],
      })
    )
    expect(response.status).toBe(400)
  })

  it('rejects a file declared larger than the size cap', async () => {
    getDb()
    const response = await POST(
      requestBody({
        password: 'empfang-secret',
        files: [{ filename: 'a.jpg', size: 21 * 1024 * 1024, contentType: 'image/jpeg' }],
      })
    )
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/uploads/request/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 3: `/api/uploads/request` implementieren**

```ts
// src/app/api/uploads/request/route.ts
import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { verifyPassword, getOrCreateAdminSecret } from '@/lib/admin-auth'
import { createPresignedPutUrl } from '@/lib/r2'
import { signUploadTicket } from '@/lib/upload-ticket'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024
const MAX_THUMB_BYTES = 2 * 1024 * 1024
const TICKET_DURATION_MS = 15 * 60 * 1000

const fileSchema = z.object({
  filename: z.string().min(1).max(200),
  size: z.number().int().positive(),
  contentType: z.string(),
})

const bodySchema = z.object({
  password: z.string().min(1).max(200),
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
  const uploadPassword = process.env.UPLOAD_PASSWORD_EMPFANG
  if (!uploadPassword || !verifyPassword(parsed.data.password, uploadPassword)) {
    return NextResponse.json({ error: 'Falsches Kennwort.' }, { status: 401 })
  }

  for (const file of parsed.data.files) {
    if (!CONTENT_TYPE_EXTENSIONS[file.contentType]) {
      return NextResponse.json({ error: `Dateityp nicht erlaubt: ${file.contentType}` }, { status: 400 })
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      return NextResponse.json({ error: 'Foto ist zu groß (max. 20 MB).' }, { status: 400 })
    }
  }

  const secret = getOrCreateAdminSecret(db)
  const tickets = await Promise.all(
    parsed.data.files.map(async (file) => {
      const extension = CONTENT_TYPE_EXTENSIONS[file.contentType]
      const photoId = randomUUID()
      const thumbKey = `gallery/${photoId}/thumb.jpg`
      const originalKey = `gallery/${photoId}/original.${extension}`
      const expiresAt = Date.now() + TICKET_DURATION_MS

      const [thumbPutUrl, originalPutUrl] = await Promise.all([
        // Kein signiertes ContentLength für das Thumbnail: seine Größe
        // steht erst nach der Browser-seitigen Kompression fest. Die
        // tatsächliche Größe wird in /api/uploads/complete per HeadObject
        // gegen MAX_THUMB_BYTES geprüft.
        createPresignedPutUrl(thumbKey, 'image/jpeg'),
        createPresignedPutUrl(originalKey, file.contentType, file.size),
      ])

      const ticket = signUploadTicket(
        { photoId, thumbKey, originalKey, thumbMaxSize: MAX_THUMB_BYTES, originalSize: file.size, expiresAt },
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
Expected: PASS (4/4)

- [ ] **Step 5: Fehlschlagenden Test für `/api/uploads/complete` schreiben**

```ts
// src/app/api/uploads/complete/route.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { getDb } from '@/lib/db'
import { getOrCreateAdminSecret } from '@/lib/admin-auth'
import { signUploadTicket, type TicketPayload } from '@/lib/upload-ticket'

const mockHeadObject = vi.fn()
vi.mock('@/lib/r2', () => ({
  headObject: (key: string) => mockHeadObject(key),
}))

function completeRequest(body: unknown): Request {
  return new Request('http://localhost/api/uploads/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function validPayload(): TicketPayload {
  return {
    photoId: 'photo-1',
    thumbKey: 'gallery/photo-1/thumb.jpg',
    originalKey: 'gallery/photo-1/original.jpg',
    thumbMaxSize: 2 * 1024 * 1024,
    originalSize: 4_000_000,
    expiresAt: Date.now() + 60_000,
  }
}

describe('POST /api/uploads/complete', () => {
  const originalPath = process.env.DATABASE_PATH

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    mockHeadObject.mockReset()
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
  })

  it('creates the photo and returns a one-time delete token when sizes match', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret)
    mockHeadObject.mockImplementation(async (key: string) =>
      key.includes('thumb') ? { size: 100_000 } : { size: 4_000_000 }
    )

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.photo.uploaderName).toBe('Anna')
    expect(typeof body.deleteToken).toBe('string')
    expect(body.deleteToken.length).toBeGreaterThan(10)
  })

  it('rejects when the real original size does not match the ticket', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret)
    mockHeadObject.mockImplementation(async (key: string) =>
      key.includes('thumb') ? { size: 100_000 } : { size: 999 }
    )

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
    expect(response.status).toBe(400)
  })

  it('rejects when the thumbnail exceeds its signed maximum', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret)
    mockHeadObject.mockImplementation(async (key: string) =>
      key.includes('thumb') ? { size: 5 * 1024 * 1024 } : { size: 4_000_000 }
    )

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
    expect(response.status).toBe(400)
  })

  it('rejects a tampered ticket without calling R2 at all', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret) + 'x'

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
    expect(response.status).toBe(400)
    expect(mockHeadObject).not.toHaveBeenCalled()
  })

  it('rejects when either object is missing from R2', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret)
    mockHeadObject.mockResolvedValue(null)

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/uploads/complete/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 7: `/api/uploads/complete` implementieren**

```ts
// src/app/api/uploads/complete/route.ts
import { randomBytes, createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getOrCreateAdminSecret } from '@/lib/admin-auth'
import { verifyUploadTicket } from '@/lib/upload-ticket'
import { headObject } from '@/lib/r2'
import { addGalleryPhoto } from '@/lib/gallery-photos'

const bodySchema = z.object({
  ticket: z.string().min(1),
  uploaderName: z.string().trim().min(1).max(60),
})

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const db = getDb()
  const secret = getOrCreateAdminSecret(db)
  const payload = verifyUploadTicket(parsed.data.ticket, secret)
  if (!payload) {
    return NextResponse.json({ error: 'Ticket ungültig oder abgelaufen.' }, { status: 400 })
  }

  const [thumbInfo, originalInfo] = await Promise.all([
    headObject(payload.thumbKey),
    headObject(payload.originalKey),
  ])

  if (!thumbInfo || thumbInfo.size > payload.thumbMaxSize) {
    return NextResponse.json({ error: 'Thumbnail fehlt oder ist zu groß.' }, { status: 400 })
  }
  if (!originalInfo || originalInfo.size !== payload.originalSize) {
    return NextResponse.json({ error: 'Original fehlt oder Größe stimmt nicht.' }, { status: 400 })
  }

  const deleteToken = randomBytes(32).toString('hex')
  const deleteTokenHash = createHash('sha256').update(deleteToken, 'utf8').digest('hex')

  const photo = addGalleryPhoto(db, {
    id: payload.photoId,
    thumbKey: payload.thumbKey,
    originalKey: payload.originalKey,
    uploaderName: parsed.data.uploaderName,
    deleteTokenHash,
  })

  return NextResponse.json({ photo, deleteToken }, { status: 201 })
}
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/uploads/complete/route.test.ts`
Expected: PASS (5/5)

- [ ] **Step 9: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 10: Commit**

```bash
git add src/app/api/uploads/request/route.ts src/app/api/uploads/request/route.test.ts \
  src/app/api/uploads/complete/route.ts src/app/api/uploads/complete/route.test.ts
git commit -m "Add the R2 upload ticket request/complete pipeline"
```

---

## Task 5: Löschen (Gast-Token/Admin) & optionaler Cloudflare-Cache-Purge

**Files:**
- Create: `src/lib/cloudflare-purge.ts`
- Test: `src/lib/cloudflare-purge.test.ts`
- Create: `src/app/api/gallery/[id]/route.ts`
- Test: `src/app/api/gallery/[id]/route.test.ts`

**Interfaces:**
- Consumes: `getGalleryPhotoById`, `deleteGalleryPhotoRow` (Task 2,
  `gallery-photos.ts`), `deleteObjects` (Task 1, `r2.ts`), `isAdminRequest`
  (bestehend).
- Produces: `purgeCache(urls: string[]): Promise<void>` aus
  `cloudflare-purge.ts` (nie wirft, best-effort). `DELETE
  /api/gallery/[id]` (Body optional `{deleteToken?: string}`) → `{success:
  true}` bei Erfolg, `403` ohne gültigen Token/Admin-Cookie, `404` bei
  unbekannter ID.

- [ ] **Step 1: Fehlschlagenden Test für `cloudflare-purge.ts` schreiben**

```ts
// src/lib/cloudflare-purge.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { purgeCache } from './cloudflare-purge'

describe('purgeCache', () => {
  const originalToken = process.env.CLOUDFLARE_API_TOKEN
  const originalZone = process.env.CLOUDFLARE_ZONE_ID

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env.CLOUDFLARE_API_TOKEN = originalToken
    process.env.CLOUDFLARE_ZONE_ID = originalZone
  })

  it('does nothing when no Cloudflare credentials are configured', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN
    delete process.env.CLOUDFLARE_ZONE_ID
    await purgeCache(['https://fotos.example.de/a.jpg'])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls the purge endpoint when credentials are configured', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'token'
    process.env.CLOUDFLARE_ZONE_ID = 'zone'
    await purgeCache(['https://fotos.example.de/a.jpg'])
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/zones/zone/purge_cache'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('never throws when the purge request itself fails', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'token'
    process.env.CLOUDFLARE_ZONE_ID = 'zone'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(purgeCache(['https://fotos.example.de/a.jpg'])).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/cloudflare-purge.test.ts`
Expected: FAIL — `Failed to resolve import "./cloudflare-purge"`

- [ ] **Step 3: `cloudflare-purge.ts` implementieren**

```ts
// src/lib/cloudflare-purge.ts

// Best-effort: Cache-Purge ist nie Voraussetzung für erfolgreiches Löschen.
// Fehlende Zugangsdaten (noch nicht eingerichtet) oder ein fehlschlagender
// HTTP-Call dürfen das Löschen der R2-Objekte/DB-Zeile nie verhindern.
export async function purgeCache(urls: string[]): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  if (!token || !zoneId || urls.length === 0) {
    return
  }

  try {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: urls }),
    })
  } catch (error) {
    console.warn('Cloudflare-Cache-Purge fehlgeschlagen, Löschen läuft trotzdem weiter.', error)
  }
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/cloudflare-purge.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Fehlschlagenden Test für `DELETE /api/gallery/[id]` schreiben**

```ts
// src/app/api/gallery/[id]/route.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { DELETE } from './route'
import { getDb } from '@/lib/db'
import { addGalleryPhoto } from '@/lib/gallery-photos'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, signCookieValue } from '@/lib/admin-auth'

vi.mock('@/lib/r2', () => ({ deleteObjects: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/cloudflare-purge', () => ({ purgeCache: vi.fn().mockResolvedValue(undefined) }))

function deleteRequest(id: string, options: { cookieValue?: string; deleteToken?: string } = {}): Request {
  const headers = new Headers()
  if (options.cookieValue) headers.set('cookie', `${ADMIN_COOKIE_NAME}=${options.cookieValue}`)
  if (options.deleteToken !== undefined) headers.set('Content-Type', 'application/json')
  return new Request(`http://localhost/api/gallery/${id}`, {
    method: 'DELETE',
    headers,
    body: options.deleteToken !== undefined ? JSON.stringify({ deleteToken: options.deleteToken }) : undefined,
  })
}

function seedPhoto(db: ReturnType<typeof getDb>, id: string, deleteToken: string) {
  const deleteTokenHash = createHash('sha256').update(deleteToken, 'utf8').digest('hex')
  addGalleryPhoto(db, {
    id,
    thumbKey: `gallery/${id}/thumb.jpg`,
    originalKey: `gallery/${id}/original.jpg`,
    uploaderName: 'Anna',
    deleteTokenHash,
  })
}

describe('DELETE /api/gallery/[id]', () => {
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

  it('deletes the photo when the correct delete token is given', async () => {
    const db = getDb()
    seedPhoto(db, 'photo-1', 'the-real-token')

    const response = await DELETE(deleteRequest('photo-1', { deleteToken: 'the-real-token' }), {
      params: Promise.resolve({ id: 'photo-1' }),
    })
    expect(response.status).toBe(200)
  })

  it('rejects a delete token that belongs to a different photo', async () => {
    const db = getDb()
    seedPhoto(db, 'photo-1', 'token-for-photo-1')
    seedPhoto(db, 'photo-2', 'token-for-photo-2')

    const response = await DELETE(deleteRequest('photo-1', { deleteToken: 'token-for-photo-2' }), {
      params: Promise.resolve({ id: 'photo-1' }),
    })
    expect(response.status).toBe(403)
  })

  it('rejects a missing delete token for a guest request', async () => {
    const db = getDb()
    seedPhoto(db, 'photo-1', 'the-real-token')

    const response = await DELETE(deleteRequest('photo-1'), {
      params: Promise.resolve({ id: 'photo-1' }),
    })
    expect(response.status).toBe(403)
  })

  it('lets an admin delete without any delete token', async () => {
    const db = getDb()
    seedPhoto(db, 'photo-1', 'the-real-token')
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await DELETE(deleteRequest('photo-1', { cookieValue }), {
      params: Promise.resolve({ id: 'photo-1' }),
    })
    expect(response.status).toBe(200)
  })

  it('returns 404 for an id that does not exist', async () => {
    getDb()
    const response = await DELETE(deleteRequest('does-not-exist', { deleteToken: 'whatever' }), {
      params: Promise.resolve({ id: 'does-not-exist' }),
    })
    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/gallery/[id]/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 7: `DELETE /api/gallery/[id]` implementieren**

```ts
// src/app/api/gallery/[id]/route.ts
import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { getGalleryPhotoById, deleteGalleryPhotoRow } from '@/lib/gallery-photos'
import { deleteObjects } from '@/lib/r2'
import { purgeCache } from '@/lib/cloudflare-purge'

const bodySchema = z.object({ deleteToken: z.string().optional() })

function matchesToken(candidate: string, expectedHash: string): boolean {
  const candidateHash = createHash('sha256').update(candidate, 'utf8').digest('hex')
  const candidateBuffer = Buffer.from(candidateHash, 'hex')
  const expectedBuffer = Buffer.from(expectedHash, 'hex')
  if (candidateBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(candidateBuffer, expectedBuffer)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const db = getDb()
  const { id } = await params

  const photo = getGalleryPhotoById(db, id)
  if (!photo) {
    return NextResponse.json({ error: 'Foto nicht gefunden.' }, { status: 404 })
  }

  const isAdmin = isAdminRequest(request, db)
  if (!isAdmin) {
    const body = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    const candidate = parsed.success ? parsed.data.deleteToken : undefined
    if (!candidate || !matchesToken(candidate, photo.deleteTokenHash)) {
      return NextResponse.json({ error: 'Nicht berechtigt.' }, { status: 403 })
    }
  }

  await deleteObjects([photo.thumbKey, photo.originalKey])
  deleteGalleryPhotoRow(db, id)

  const baseUrl = process.env.R2_PUBLIC_BASE_URL ?? ''
  await purgeCache([`${baseUrl}/${photo.thumbKey}`, `${baseUrl}/${photo.originalKey}`])

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/gallery/[id]/route.test.ts`
Expected: PASS (5/5)

- [ ] **Step 9: Gesamte Toolchain inklusive Build prüfen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün

- [ ] **Step 10: Commit**

```bash
git add src/lib/cloudflare-purge.ts src/lib/cloudflare-purge.test.ts \
  src/app/api/gallery/\[id\]/route.ts src/app/api/gallery/\[id\]/route.test.ts
git commit -m "Add guest/admin photo deletion with best-effort cache purge"
```

---

## Abschluss

Nach Task 5 existiert das komplette Galerie-Backend: Zugriffs-Modus,
Upload-Pipeline (Ticket, presigned URLs, Bestätigung) und Löschen — alles
über echte `better-sqlite3`-Integrationstests abgedeckt, `src/lib/r2.ts` als
einziger Berührungspunkt mit echtem R2 und in allen Routen-Tests gemockt.
Das Frontend (Galerie-Seite, Upload-UI, Admin-Dashboard-Erweiterung) ist ein
eigener Folge-Plan, der auf den hier festgelegten API-Formen aufbaut.
