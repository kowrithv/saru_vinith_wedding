# Ops Hardening and Upload Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a photo-upload kill switch, in-app SQLite backups with e-mail alerts, and the deferred upload/admin polish items.

**Architecture:** The kill switch is a fourth entry in the existing `app_config`-backed write-lock system, enforced in the two upload routes and reflected by `GET /api/gallery`. Backups and alerts are plain server modules (`backup.ts`, `alerts.ts`, `ops-scheduler.ts`) started once from `instrumentation.ts` in production. The polish items change `GalleryUploadForm`, the form field class strings and `AdminDashboard`.

**Tech Stack:** Next.js 16 App Router, React 19, better-sqlite3 13 (`db.backup()`), nodemailer (new, SMTP), Vitest + React Testing Library, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-12-ops-hardening-and-upload-polish-design.md`

## Global Constraints

- UI texts and code comments in German; identifiers and commit messages in English (imperative). Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Dependencies are pinned exactly (no `^`/`~`), as in `package.json`. The only new runtime dependency is `nodemailer`; `@types/nodemailer` is a dev dependency.
- Locked-feature responses use HTTP `423` (like the guestbook); the admin is always exempt from the upload lock.
- The scheduler runs only when `NODE_ENV === 'production'` and `NEXT_RUNTIME === 'nodejs'`; timers are `unref()`ed.
- Backup folder is `<folder of DATABASE_PATH>/backups`; file names `wedding-YYYYMMDD-HHmmss.db` (UTC); retention 48 hourly + 30 daily.
- Disk alarm threshold 85 %; alert cool-down 6 h per key (start mail 15 min), persisted in `app_config`.
- Upload timeout 5 minutes per file; groups of 3 files stay as implemented.
- Vitest does not type-check: run `npm run typecheck` after interface changes.
- A task is done only with `npm run typecheck`, `npm run lint` and `npm test` green.

## Review Focus

- A ticket issued before the lock must not register a photo after the lock (non-admin), while admin tickets and admin uploads keep working.
- A backup taken while the app is writing (WAL) must be readable and contain the data; a corrupt copy must not stay in the rotation.
- A broken or hanging SMTP server must never throw into, or block, a request or the scheduler tick.
- The scheduler must not start in tests/dev and must not start twice in one process.
- Cancelling mid-upload must leave no file stuck in "uploading", and a retry must upload only unfinished files.
- Collapsing an admin section must not drop the upload form's state (keep children mounted).

---

### Task 1: Upload lock — shared feature list and server enforcement

**Files:**
- Modify: `src/lib/app-config.ts`, `src/lib/app-config.test.ts`
- Modify: `src/lib/gallery-upload-limits.ts`
- Modify: `src/app/api/admin/write-lock/route.ts`, `src/app/api/admin/write-lock/route.test.ts`
- Modify: `src/app/api/uploads/request/route.ts`, `src/app/api/uploads/request/route.test.ts`
- Modify: `src/app/api/uploads/complete/route.ts`, `src/app/api/uploads/complete/route.test.ts`
- Modify: `src/app/api/gallery/route.ts`, `src/app/api/gallery/route.test.ts`

**Interfaces:**
- Produces: `LOCKABLE_FEATURES` (readonly tuple `['guestbook','memories','who_votes','gallery_upload']`), `LockableFeature`, `UPLOADS_PAUSED_MESSAGE` (string), `GET /api/gallery` field `uploadsLocked: boolean`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/app-config.test.ts` add (imports `LOCKABLE_FEATURES` next to the existing imports; `db` is created the way the existing tests in this file do it):

```ts
describe('LOCKABLE_FEATURES', () => {
  it('contains the three write locks and the gallery upload', () => {
    expect([...LOCKABLE_FEATURES]).toEqual(['guestbook', 'memories', 'who_votes', 'gallery_upload'])
  })

  it('locks and unlocks gallery_upload independently of the other features', () => {
    setFeatureLocked(db, 'gallery_upload', true)
    expect(isFeatureLocked(db, 'gallery_upload')).toBe(true)
    expect(isFeatureLocked(db, 'guestbook')).toBe(false)
    setFeatureLocked(db, 'gallery_upload', false)
    expect(isFeatureLocked(db, 'gallery_upload')).toBe(false)
  })
})
```

In `src/app/api/admin/write-lock/route.test.ts`: change every expected lock object `{ guestbook: …, memories: …, who_votes: … }` to also contain `gallery_upload: false` (rename the test "returns all three lock states" to "returns all four lock states"), and add:

```ts
it.each(['guestbook', 'memories', 'who_votes', 'gallery_upload'] as const)(
  'POST locks only %s and leaves the other features alone',
  async (feature) => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const cookieValue = signCookieValue(Date.now() + 1000, secret)

    const response = await POST(requestWithCookie('POST', cookieValue, { feature, locked: true }))
    expect(response.status).toBe(200)
    const { locks } = await response.json()

    expect(locks[feature]).toBe(true)
    expect(Object.values(locks).filter(Boolean)).toHaveLength(1)
  }
)
```

In `src/app/api/uploads/request/route.test.ts` add (imports `setFeatureLocked` from `@/lib/app-config`; `requestBody` helper already supports a cookie value and client IP):

```ts
it('refuses a guest upload with 423 while uploads are locked, before the password is even checked', async () => {
  const db = getDb()
  setFeatureLocked(db, 'gallery_upload', true)
  const response = await POST(
    requestBody(
      { password: 'falsch', category: 'Hochzeit', files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }] },
      undefined,
      '10.0.1.1'
    )
  )
  expect(response.status).toBe(423)
  expect((await response.json()).error).toMatch(/pausiert/i)
})

it('still issues tickets to the admin while uploads are locked', async () => {
  const db = getDb()
  setFeatureLocked(db, 'gallery_upload', true)
  const secret = getOrCreateAdminSecret(db)
  const cookieValue = signCookieValue(Date.now() + 60_000, secret)
  const response = await POST(
    requestBody(
      { category: 'Hochzeit', files: [{ filename: 'a.jpg', size: 1000, contentType: 'image/jpeg' }] },
      cookieValue,
      '10.0.1.2'
    )
  )
  expect(response.status).toBe(200)
})
```

In `src/app/api/uploads/complete/route.test.ts` add (uses the file's existing `validPayload`, `completeRequest`, `mockHeadObject`):

```ts
it('refuses to register a guest ticket with 423 once uploads are locked', async () => {
  const db = getDb()
  const secret = getOrCreateAdminSecret(db)
  setFeatureLocked(db, 'gallery_upload', true)
  const ticket = signUploadTicket(validPayload(), secret)
  mockHeadObject.mockResolvedValue({ size: 4_000_000 })

  const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))

  expect(response.status).toBe(423)
  expect(mockHeadObject).not.toHaveBeenCalled()
})

it('still registers an admin ticket while uploads are locked', async () => {
  const db = getDb()
  const secret = getOrCreateAdminSecret(db)
  setFeatureLocked(db, 'gallery_upload', true)
  const ticket = signUploadTicket({ ...validPayload(), isOfficial: true }, secret)
  mockHeadObject.mockImplementation(async (key: string) =>
    key.includes('thumb') ? { size: 100_000 } : { size: 4_000_000 }
  )

  const response = await POST(completeRequest({ ticket, uploaderName: 'Saruga' }))

  expect(response.status).toBe(201)
})
```

In `src/app/api/gallery/route.test.ts` add:

```ts
it('reports whether uploads are currently locked', async () => {
  const db = getDb()
  expect((await (await GET(requestWithCookies({}))).json()).uploadsLocked).toBe(false)

  setFeatureLocked(db, 'gallery_upload', true)
  expect((await (await GET(requestWithCookies({}))).json()).uploadsLocked).toBe(true)
})
```

(import `setFeatureLocked` from `@/lib/app-config` in each of the three test files.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/app-config.test.ts src/app/api/admin/write-lock src/app/api/uploads src/app/api/gallery/route.test.ts`
Expected: FAIL (`LOCKABLE_FEATURES` undefined, 200 instead of 423, `uploadsLocked` undefined, locks object missing `gallery_upload`).

- [ ] **Step 3: Implement**

`src/lib/app-config.ts` — replace the type and keys:

```ts
export const LOCKABLE_FEATURES = ['guestbook', 'memories', 'who_votes', 'gallery_upload'] as const
export type LockableFeature = (typeof LOCKABLE_FEATURES)[number]

const LOCK_KEYS: Record<LockableFeature, string> = {
  guestbook: 'guestbook_locked',
  memories: 'memories_locked',
  who_votes: 'who_votes_locked',
  gallery_upload: 'gallery_upload_locked',
}
```

`src/lib/gallery-upload-limits.ts` — append:

```ts
export const UPLOADS_PAUSED_MESSAGE = 'Foto-Uploads sind derzeit pausiert.'
```

`src/app/api/admin/write-lock/route.ts` — derive the list from the shared constant:

```ts
import { isFeatureLocked, setFeatureLocked, LOCKABLE_FEATURES, type LockableFeature } from '@/lib/app-config'

const bodySchema = z.object({
  feature: z.enum(LOCKABLE_FEATURES),
  locked: z.boolean(),
})

function allLocks(db: Database.Database): Record<LockableFeature, boolean> {
  return Object.fromEntries(
    LOCKABLE_FEATURES.map((feature) => [feature, isFeatureLocked(db, feature)])
  ) as Record<LockableFeature, boolean>
}
```
(delete the old `FEATURES` constant.)

`src/app/api/uploads/request/route.ts` — import `isFeatureLocked` and `UPLOADS_PAUSED_MESSAGE`, and directly after `const isOfficial = isAdminRequest(request, db)` add:

```ts
  if (!isOfficial && isFeatureLocked(db, 'gallery_upload')) {
    return NextResponse.json({ error: UPLOADS_PAUSED_MESSAGE }, { status: 423 })
  }
```

`src/app/api/uploads/complete/route.ts` — import the same two, and directly after the `if (!payload) {…}` block add:

```ts
  // Tickets, die vor der Sperre ausgestellt wurden, gelten nicht mehr -
  // sonst liefen laufende Uploads nach dem "Notaus" noch bis zu 15 Minuten
  // weiter. Admin-Tickets (offizielle Fotos) bleiben davon unberührt.
  if (!payload.isOfficial && isFeatureLocked(db, 'gallery_upload')) {
    return NextResponse.json({ error: UPLOADS_PAUSED_MESSAGE }, { status: 423 })
  }
```

`src/app/api/gallery/route.ts` — import `isFeatureLocked`, compute `const uploadsLocked = isFeatureLocked(db, 'gallery_upload')` after `const mode = …`, and add `uploadsLocked` to both `NextResponse.json({...})` bodies.

- [ ] **Step 4: Run tests, typecheck**

Run: `npx vitest run src/lib/app-config.test.ts src/app/api && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib src/app/api
git commit -m "Add the gallery upload lock to the write-lock system"
```

---

### Task 2: Upload lock — admin switch and gallery page

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`, `src/components/admin/AdminDashboard.test.tsx`
- Modify: `src/app/admin/page.tsx`, `src/app/admin/page.test.tsx`
- Modify: `src/app/gallery/page.tsx`, `src/app/gallery/page.test.tsx`

**Interfaces:**
- Consumes: `locks.gallery_upload` from `GET/POST /api/admin/write-lock`, `uploadsLocked` from `GET /api/gallery` (Task 1).

- [ ] **Step 1: Write the failing tests**

`src/components/admin/AdminDashboard.test.tsx`: change `const noLocks = { guestbook: false, memories: false, who_votes: false }` to include `gallery_upload: false`, and add:

```ts
it('shows a fourth switch for the photo upload and sends gallery_upload when it is toggled', async () => {
  const fetchMock = mockFetchSequence([
    { body: { entries: [] } },
    { body: { entries: [] } },
    noGalleryPhotos,
    { body: { locks: { guestbook: false, memories: false, who_votes: false, gallery_upload: true } } },
  ])
  render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

  const toggle = screen.getByRole('switch', { name: /foto-upload/i })
  expect(toggle).toHaveAttribute('aria-checked', 'false')

  await userEvent.click(toggle)

  await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/admin/write-lock',
    expect.objectContaining({ body: JSON.stringify({ feature: 'gallery_upload', locked: true }) })
  )
  expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'false')
})
```

`src/app/admin/page.test.tsx`: add `gallery_upload: boolean` to its local `Locks` interface and `gallery_upload: false` to the three lock literals.

`src/app/gallery/page.test.tsx` add:

```ts
it('hides the upload button and explains why while uploads are locked', async () => {
  mockFetchSequence([{ body: { mode: 'public', unlocked: true, uploadsLocked: true, photos: [samplePhoto] } }])
  render(<GalleryPage />)

  await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
  expect(screen.queryByRole('button', { name: /fotos hochladen/i })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(/hochladen ist gerade pausiert/i)
})

it('keeps the upload flag when a photo is added or deleted afterwards', async () => {
  mockFetchSequence([{ body: { mode: 'public', unlocked: true, uploadsLocked: false, photos: [samplePhoto] } }])
  render(<GalleryPage />)
  await userEvent.click(await screen.findByRole('button', { name: /fotos hochladen/i }))
  await userEvent.click(screen.getByRole('button', { name: 'stub-upload' }))

  await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
  expect(screen.getByRole('button', { name: /schließen/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin src/app/admin src/app/gallery/page.test.tsx`
Expected: FAIL (no fourth switch; upload button still shown).

- [ ] **Step 3: Implement**

`src/components/admin/AdminDashboard.tsx`:
- `interface Locks` add `gallery_upload: boolean`.
- `FEATURE_LABELS` add `gallery_upload: 'Foto-Upload',`.

`src/app/admin/page.tsx`: `interface Locks` add `gallery_upload: boolean`.

`src/app/gallery/page.tsx`:

```ts
type GalleryData =
  | { status: 'loading' }
  | { status: 'locked' }
  | { status: 'error' }
  | { status: 'unlocked'; photos: GalleryPhotoView[]; uploadsLocked: boolean }
```
In `loadGallery` change the typed body to `{ unlocked: boolean; photos: GalleryPhotoView[] | null; uploadsLocked?: boolean }` and the success branch to:

```ts
setData(
  body.unlocked && body.photos
    ? { status: 'unlocked', photos: body.photos, uploadsLocked: Boolean(body.uploadsLocked) }
    : { status: 'locked' }
)
```
`handlePhotoDeleted` → `prev.status === 'unlocked' ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) } : prev`; `handleUploaded` → `prev.status === 'unlocked' ? { ...prev, photos: [photo, ...prev.photos] } : prev`.

In the unlocked JSX wrap the floating button and the `{showUploadForm && …}` panel in `{!data.uploadsLocked && (<>…</>)}` and add before the grid:

```tsx
{data.uploadsLocked && (
  <p role="status" className="max-w-xl mx-auto mb-8 text-center text-sm text-gray-600">
    Das Hochladen ist gerade pausiert. Die Fotos könnt ihr euch weiterhin ansehen.
  </p>
)}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run src/components/admin src/app/admin src/app/gallery && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin src/app/admin src/app/gallery
git commit -m "Add the photo upload switch to the admin dashboard and pause the gallery upload UI"
```

---

### Task 3: SQLite backup with integrity check and rotation

**Files:**
- Create: `src/lib/backup.ts`
- Test: `src/lib/backup.test.ts`

**Interfaces:**
- Produces:
  - `backupFileName(now: Date): string`
  - `selectBackupsToDelete(fileNames: string[]): string[]`
  - `createBackup(db: Database.Database, dir: string, now?: Date): Promise<{ fileName: string; filePath: string; sizeBytes: number }>`
  - `pruneBackups(dir: string): string[]` (returns the deleted file names)
  - constants `HOURLY_KEEP = 48`, `DAILY_KEEP = 30`

- [ ] **Step 1: Write the failing tests** — `src/lib/backup.test.ts`

```ts
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applySchema } from './db'
import {
  backupFileName,
  createBackup,
  DAILY_KEEP,
  HOURLY_KEEP,
  pruneBackups,
  selectBackupsToDelete,
} from './backup'

function nameFor(isoUtc: string): string {
  return backupFileName(new Date(isoUtc))
}

describe('backupFileName', () => {
  it('uses the UTC timestamp so names sort chronologically', () => {
    expect(backupFileName(new Date('2026-10-17T14:30:05Z'))).toBe('wedding-20261017-143005.db')
  })
})

describe('selectBackupsToDelete', () => {
  it('keeps everything while there are fewer files than the hourly window', () => {
    const names = [nameFor('2026-10-17T10:00:00Z'), nameFor('2026-10-17T11:00:00Z')]
    expect(selectBackupsToDelete(names)).toEqual([])
  })

  it('keeps the newest 48 plus the first backup of each of the last 30 days, and deletes the rest', () => {
    // 10 Tage stündlich = 240 Dateien
    const names: string[] = []
    for (let day = 1; day <= 10; day++) {
      for (let hour = 0; hour < 24; hour++) {
        names.push(nameFor(`2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`))
      }
    }

    const deleted = selectBackupsToDelete(names)
    const kept = names.filter((name) => !deleted.includes(name))

    // 48 neueste (letzte zwei Tage) + je erste des Tages für die übrigen 8 Tage
    expect(kept).toHaveLength(HOURLY_KEEP + 8)
    expect(kept).toContain(nameFor('2026-10-10T23:00:00Z'))
    expect(kept).toContain(nameFor('2026-10-03T00:00:00Z'))
    expect(kept).not.toContain(nameFor('2026-10-03T05:00:00Z'))
  })

  it('keeps at most one daily backup for each of the newest 30 days', () => {
    const names: string[] = []
    for (let day = 1; day <= 31; day++) {
      names.push(nameFor(`2026-08-${String(day).padStart(2, '0')}T06:00:00Z`))
    }
    for (let day = 1; day <= 30; day++) {
      names.push(nameFor(`2026-09-${String(day).padStart(2, '0')}T06:00:00Z`))
    }
    const kept = names.filter((name) => !selectBackupsToDelete(names).includes(name))
    // 48 neueste (alle aus den letzten 48 Tagen) ∪ 30 Tages-Backups
    expect(kept.length).toBeLessThanOrEqual(HOURLY_KEEP + DAILY_KEEP)
    expect(kept).toContain(nameFor('2026-09-30T06:00:00Z'))
    expect(kept).not.toContain(nameFor('2026-08-01T06:00:00Z'))
  })

  it('never selects files that are not backups', () => {
    const names = ['notes.txt', 'wedding.db', 'wedding-20261017-143005.db-wal', nameFor('2026-10-17T10:00:00Z')]
    expect(selectBackupsToDelete(names)).toEqual([])
  })
})

describe('createBackup / pruneBackups', () => {
  let dir: string
  let source: Database.Database

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'backup-test-'))
    source = new Database(path.join(dir, 'source.db'))
    applySchema(source)
  })

  afterEach(() => {
    source.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('writes a readable copy that contains the current data', async () => {
    source.prepare("INSERT INTO app_config (key, value) VALUES ('hello', 'world')").run()
    const backupDir = path.join(dir, 'backups')

    const result = await createBackup(source, backupDir, new Date('2026-10-17T14:30:05Z'))

    expect(result.fileName).toBe('wedding-20261017-143005.db')
    expect(result.sizeBytes).toBeGreaterThan(0)
    const copy = new Database(result.filePath, { readonly: true })
    const row = copy.prepare("SELECT value FROM app_config WHERE key = 'hello'").get() as { value: string }
    copy.close()
    expect(row.value).toBe('world')
  })

  it('leaves only the backup file in the folder (no WAL/SHM leftovers from the integrity check)', async () => {
    const backupDir = path.join(dir, 'backups')
    await createBackup(source, backupDir, new Date('2026-10-17T14:30:05Z'))
    expect(readdirSync(backupDir)).toEqual(['wedding-20261017-143005.db'])
  })

  it('rejects and removes the file when the copy fails the integrity check', async () => {
    const backupDir = path.join(dir, 'backups')
    const brokenDb = {
      backup: async (target: string) => {
        writeFileSync(target, 'this is not a database')
      },
    } as unknown as Database.Database

    await expect(createBackup(brokenDb, backupDir, new Date('2026-10-17T14:30:05Z'))).rejects.toThrow()
    expect(readdirSync(backupDir)).toEqual([])
  })

  it('prunes the folder according to the retention rules and reports what it deleted', () => {
    const backupDir = path.join(dir, 'backups')
    require('node:fs').mkdirSync(backupDir)
    for (let hour = 0; hour < 24; hour++) {
      for (let day = 1; day <= 4; day++) {
        const stamp = `2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`
        writeFileSync(path.join(backupDir, nameFor(stamp)), 'x')
      }
    }
    writeFileSync(path.join(backupDir, 'README.txt'), 'keep me')

    const deleted = pruneBackups(backupDir)

    expect(deleted.length).toBeGreaterThan(0)
    expect(readdirSync(backupDir)).toContain('README.txt')
    expect(readdirSync(backupDir).filter((n) => n.endsWith('.db'))).toHaveLength(HOURLY_KEEP + 2)
  })
})
```

(Replace the `require('node:fs').mkdirSync` line by importing `mkdirSync` from `node:fs` at the top — shown inline only to keep the snippet short.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/backup.test.ts`
Expected: FAIL (module `./backup` not found).

- [ ] **Step 3: Implement** — `src/lib/backup.ts`

```ts
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

export const HOURLY_KEEP = 48
export const DAILY_KEEP = 30

const BACKUP_FILE_PATTERN = /^wedding-\d{8}-\d{6}\.db$/

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

// UTC, damit die Namen lexikographisch = chronologisch sortieren und die
// Rotation nicht von der Zeitzone des Servers abhängt.
export function backupFileName(now: Date): string {
  const date = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  return `wedding-${date}-${time}.db`
}

/**
 * Aufbewahrung: die neuesten HOURLY_KEEP Sicherungen plus je die erste
 * Sicherung eines Tages für die neuesten DAILY_KEEP Tage. Dateien, die
 * keine Sicherungen sind, werden nie ausgewählt.
 */
export function selectBackupsToDelete(fileNames: string[]): string[] {
  const backups = fileNames.filter((name) => BACKUP_FILE_PATTERN.test(name)).sort()
  const keep = new Set(backups.slice(-HOURLY_KEEP))

  const firstOfDay = new Map<string, string>()
  for (const name of backups) {
    const day = name.slice(8, 16)
    if (!firstOfDay.has(day)) firstOfDay.set(day, name)
  }
  const newestDays = [...firstOfDay.keys()].sort().slice(-DAILY_KEEP)
  for (const day of newestDays) keep.add(firstOfDay.get(day) as string)

  return backups.filter((name) => !keep.has(name))
}

function verifyBackup(filePath: string): void {
  const copy = new Database(filePath, { readonly: true, fileMustExist: true })
  try {
    const rows = copy.pragma('integrity_check') as { integrity_check: string }[]
    if (rows.length !== 1 || rows[0].integrity_check !== 'ok') {
      throw new Error(`Integritätsprüfung fehlgeschlagen: ${JSON.stringify(rows).slice(0, 200)}`)
    }
  } finally {
    copy.close()
  }
  // Das schreibgeschützte Öffnen einer WAL-Datenbank kann Begleitdateien
  // anlegen, die nach dem Schließen nicht zur Sicherung gehören.
  rmSync(`${filePath}-wal`, { force: true })
  rmSync(`${filePath}-shm`, { force: true })
}

export interface BackupResult {
  fileName: string
  filePath: string
  sizeBytes: number
}

export async function createBackup(
  db: Database.Database,
  dir: string,
  now: Date = new Date()
): Promise<BackupResult> {
  mkdirSync(dir, { recursive: true })
  const fileName = backupFileName(now)
  const filePath = path.join(dir, fileName)
  try {
    await db.backup(filePath)
    verifyBackup(filePath)
  } catch (error) {
    // Eine defekte Kopie darf nicht in der Rotation bleiben.
    rmSync(filePath, { force: true })
    rmSync(`${filePath}-wal`, { force: true })
    rmSync(`${filePath}-shm`, { force: true })
    throw error
  }
  return { fileName, filePath, sizeBytes: statSync(filePath).size }
}

export function pruneBackups(dir: string): string[] {
  const doomed = selectBackupsToDelete(readdirSync(dir))
  for (const name of doomed) {
    rmSync(path.join(dir, name), { force: true })
  }
  return doomed
}
```

- [ ] **Step 4: Run tests, typecheck**

Run: `npx vitest run src/lib/backup.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/backup.ts src/lib/backup.test.ts
git commit -m "Add SQLite backup with integrity check and rotation"
```

---

### Task 4: Alerts by e-mail with persisted cool-down

**Files:**
- Modify: `package.json`, `package-lock.json` (nodemailer, @types/nodemailer)
- Modify: `src/lib/app-config.ts`, `src/lib/app-config.test.ts`
- Create: `src/lib/alerts.ts`
- Test: `src/lib/alerts.test.ts`

**Interfaces:**
- Consumes: `app_config` table.
- Produces:
  - `getConfigValue(db, key): string | undefined`, `setConfigValue(db, key, value): void` (in `app-config.ts`)
  - `readSmtpSettings(env?): SmtpSettings | null`
  - `sendAlert(input: AlertInput, options?: SendAlertOptions): Promise<'sent' | 'logged' | 'suppressed' | 'failed'>` with
    `AlertInput = { key: string; subject: string; body: string; cooldownMs?: number }` and
    `SendAlertOptions = { db?: Database.Database; now?: () => number; env?: NodeJS.ProcessEnv; createTransport?: typeof nodemailer.createTransport }`
  - `DEFAULT_COOLDOWN_MS = 6 * 60 * 60 * 1000`

- [ ] **Step 1: Install the dependency**

Run: `npm view nodemailer time --json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const t=JSON.parse(d);console.log(Object.entries(t).filter(([k])=>/^\d+\.\d+\.\d+$/.test(k)).slice(-5).map(([k,v])=>k+" "+v).join("\n"))})'`
Pick the newest version that is at least 14 days old, then:
`npm install --save-exact nodemailer@<that version> && npm install --save-dev --save-exact @types/nodemailer`
Expected: both appear in `package.json` without `^`; `npm run typecheck` still passes.

- [ ] **Step 2: Write the failing tests**

`src/lib/app-config.test.ts` add:

```ts
describe('config values', () => {
  it('returns undefined for an unknown key and round-trips a value', () => {
    expect(getConfigValue(db, 'alert_last_sent:test')).toBeUndefined()
    setConfigValue(db, 'alert_last_sent:test', '123')
    expect(getConfigValue(db, 'alert_last_sent:test')).toBe('123')
    setConfigValue(db, 'alert_last_sent:test', '456')
    expect(getConfigValue(db, 'alert_last_sent:test')).toBe('456')
  })
})
```

`src/lib/alerts.test.ts`:

```ts
import type nodemailer from 'nodemailer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb } from './db'
import { DEFAULT_COOLDOWN_MS, readSmtpSettings, sendAlert } from './alerts'

const smtpEnv = {
  SMTP_HOST: 'smtp.example.de',
  SMTP_USER: 'alerts@example.de',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM: 'Hochzeitsseite <alerts@example.de>',
  ALERT_EMAIL_TO: 'a@example.de, b@example.de',
} as unknown as NodeJS.ProcessEnv

describe('readSmtpSettings', () => {
  it('returns null unless host, from and recipient are all set', () => {
    expect(readSmtpSettings({} as NodeJS.ProcessEnv)).toBeNull()
    expect(readSmtpSettings({ SMTP_HOST: 'h', SMTP_FROM: 'f' } as unknown as NodeJS.ProcessEnv)).toBeNull()
  })

  it('defaults to port 587, splits recipients and keeps credentials', () => {
    const settings = readSmtpSettings(smtpEnv)
    expect(settings).toEqual({
      host: 'smtp.example.de',
      port: 587,
      user: 'alerts@example.de',
      password: 'secret',
      from: 'Hochzeitsseite <alerts@example.de>',
      to: ['a@example.de', 'b@example.de'],
    })
  })
})

describe('sendAlert', () => {
  let db: ReturnType<typeof createDb>
  const sendMail = vi.fn()
  const createTransport = vi.fn(() => ({ sendMail })) as unknown as typeof nodemailer.createTransport
  let nowMs: number

  beforeEach(() => {
    db = createDb(':memory:')
    sendMail.mockReset().mockResolvedValue({})
    ;(createTransport as unknown as ReturnType<typeof vi.fn>).mockClear()
    nowMs = Date.UTC(2026, 9, 17, 12, 0, 0)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  const options = () => ({ db, now: () => nowMs, env: smtpEnv, createTransport })

  it('only logs when SMTP is not configured', async () => {
    const result = await sendAlert(
      { key: 'disk-full', subject: 'Platte voll', body: 'Details' },
      { db, now: () => nowMs, env: {} as NodeJS.ProcessEnv, createTransport }
    )
    expect(result).toBe('logged')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Platte voll'))
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('sends one mail to all recipients with a prefixed subject', async () => {
    const result = await sendAlert({ key: 'backup-failed', subject: 'Backup fehlgeschlagen', body: 'Details' }, options())

    expect(result).toBe('sent')
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Hochzeitsseite <alerts@example.de>',
      to: 'a@example.de, b@example.de',
      subject: '[Hochzeitsseite] Backup fehlgeschlagen',
      text: 'Details',
    })
  })

  it('uses TLS settings and timeouts that cannot hang a request', async () => {
    await sendAlert({ key: 'k', subject: 's', body: 'b' }, options())
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.de',
        port: 587,
        secure: false,
        requireTLS: true,
        connectionTimeout: 10_000,
        socketTimeout: 15_000,
      })
    )
  })

  it('suppresses a repeated alert inside the cool-down and allows it afterwards', async () => {
    const input = { key: 'disk-full', subject: 's', body: 'b' }
    expect(await sendAlert(input, options())).toBe('sent')

    nowMs += DEFAULT_COOLDOWN_MS - 1
    expect(await sendAlert(input, options())).toBe('suppressed')

    nowMs += 1
    expect(await sendAlert(input, options())).toBe('sent')
    expect(sendMail).toHaveBeenCalledTimes(2)
  })

  it('keeps the cool-down per key', async () => {
    await sendAlert({ key: 'a', subject: 's', body: 'b' }, options())
    expect(await sendAlert({ key: 'b', subject: 's', body: 'b' }, options())).toBe('sent')
  })

  it('honours a custom cool-down', async () => {
    const input = { key: 'app-started', subject: 's', body: 'b', cooldownMs: 15 * 60 * 1000 }
    await sendAlert(input, options())
    nowMs += 15 * 60 * 1000
    expect(await sendAlert(input, options())).toBe('sent')
  })

  it('swallows a send failure, logs it and does not start a cool-down', async () => {
    sendMail.mockRejectedValueOnce(new Error('connect ETIMEDOUT'))

    const result = await sendAlert({ key: 'k', subject: 's', body: 'b' }, options())

    expect(result).toBe('failed')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ETIMEDOUT'))
    expect(await sendAlert({ key: 'k', subject: 's', body: 'b' }, options())).toBe('sent')
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/app-config.test.ts src/lib/alerts.test.ts`
Expected: FAIL (`getConfigValue` / `./alerts` not found).

- [ ] **Step 4: Implement**

`src/lib/app-config.ts` append:

```ts
export function getConfigValue(db: Database.Database, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value
}

export function setConfigValue(db: Database.Database, key: string, value: string): void {
  db.prepare(
    'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value)
}
```

`src/lib/alerts.ts`:

```ts
import type Database from 'better-sqlite3'
import nodemailer from 'nodemailer'
import { getDb } from '@/lib/db'
import { getConfigValue, setConfigValue } from '@/lib/app-config'

export const DEFAULT_COOLDOWN_MS = 6 * 60 * 60 * 1000

export interface SmtpSettings {
  host: string
  port: number
  user?: string
  password?: string
  from: string
  to: string[]
}

export interface AlertInput {
  key: string
  subject: string
  body: string
  cooldownMs?: number
}

export interface SendAlertOptions {
  db?: Database.Database
  now?: () => number
  env?: NodeJS.ProcessEnv
  createTransport?: typeof nodemailer.createTransport
}

export type AlertResult = 'sent' | 'logged' | 'suppressed' | 'failed'

export function readSmtpSettings(env: NodeJS.ProcessEnv = process.env): SmtpSettings | null {
  const host = env.SMTP_HOST?.trim()
  const from = env.SMTP_FROM?.trim()
  const to = (env.ALERT_EMAIL_TO ?? '')
    .split(/[,;\s]+/)
    .map((address) => address.trim())
    .filter(Boolean)
  if (!host || !from || to.length === 0) return null

  const port = Number.parseInt(env.SMTP_PORT ?? '', 10) || 587
  return {
    host,
    port,
    user: env.SMTP_USER || undefined,
    password: env.SMTP_PASSWORD || undefined,
    from,
    to,
  }
}

/**
 * Meldet ein Betriebsproblem: immer ins Log, zusätzlich per E-Mail, wenn SMTP
 * konfiguriert ist. Wirft nie - ein defekter Mailserver darf weder eine
 * Anfrage noch den Scheduler stören. Je `key` gibt es eine Abkühlzeit, die in
 * der Datenbank steht und Neustarts überlebt.
 */
export async function sendAlert(input: AlertInput, options: SendAlertOptions = {}): Promise<AlertResult> {
  const now = options.now ?? Date.now
  const env = options.env ?? process.env
  const createTransport = options.createTransport ?? nodemailer.createTransport.bind(nodemailer)
  const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS
  const configKey = `alert_last_sent:${input.key}`

  try {
    const db = options.db ?? getDb()
    const last = Number(getConfigValue(db, configKey) ?? '0')
    if (now() - last < cooldownMs) return 'suppressed'

    const settings = readSmtpSettings(env)
    if (!settings) {
      console.warn(`[alert] ${input.subject} - ${input.body}`)
      setConfigValue(db, configKey, String(now()))
      return 'logged'
    }

    console.warn(`[alert] ${input.subject} - ${input.body}`)
    const transport = createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.port === 465,
      requireTLS: settings.port !== 465,
      auth: settings.user ? { user: settings.user, pass: settings.password } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
    await transport.sendMail({
      from: settings.from,
      to: settings.to.join(', '),
      subject: `[Hochzeitsseite] ${input.subject}`,
      text: input.body,
    })
    setConfigValue(db, configKey, String(now()))
    return 'sent'
  } catch (error) {
    console.error(`[alert] Versand fehlgeschlagen (${input.subject}): ${error instanceof Error ? error.message : String(error)}`)
    return 'failed'
  }
}
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run src/lib/app-config.test.ts src/lib/alerts.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/app-config.ts src/lib/app-config.test.ts src/lib/alerts.ts src/lib/alerts.test.ts
git commit -m "Add e-mail alerts with a persisted cool-down"
```

---

### Task 5: Ops scheduler, instrumentation hook and operator docs

**Files:**
- Create: `src/lib/ops-scheduler.ts`
- Test: `src/lib/ops-scheduler.test.ts`
- Modify: `src/instrumentation.ts`, `src/instrumentation.test.ts`
- Modify: `.env.example`, `README.md`, `TODO.md`

**Interfaces:**
- Consumes: `createBackup`, `pruneBackups` (Task 3), `sendAlert` (Task 4), `getDb`.
- Produces:
  - `diskUsageFraction(dir: string, statfs?: typeof statfsSync): number`
  - `startOpsScheduler(deps?: SchedulerDeps): { stop: () => void }` with
    `SchedulerDeps = { getDb?, backupDir?, createBackup?, pruneBackups?, sendAlert?, diskUsage?, now?: () => Date }`
  - constants `BACKUP_INTERVAL_MS = 3_600_000`, `DISK_CHECK_INTERVAL_MS = 600_000`, `DISK_ALERT_THRESHOLD = 0.85`

- [ ] **Step 1: Write the failing tests**

`src/lib/ops-scheduler.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BACKUP_INTERVAL_MS,
  DISK_ALERT_THRESHOLD,
  DISK_CHECK_INTERVAL_MS,
  diskUsageFraction,
  startOpsScheduler,
} from './ops-scheduler'

describe('diskUsageFraction', () => {
  it('computes used blocks relative to all blocks of the file system', () => {
    const statfs = vi.fn(() => ({ blocks: 1000, bavail: 150 })) as never
    expect(diskUsageFraction('/data', statfs)).toBeCloseTo(0.85)
  })
})

describe('startOpsScheduler', () => {
  const fakeDb = {} as never
  let deps: {
    getDb: ReturnType<typeof vi.fn>
    createBackup: ReturnType<typeof vi.fn>
    pruneBackups: ReturnType<typeof vi.fn>
    sendAlert: ReturnType<typeof vi.fn>
    diskUsage: ReturnType<typeof vi.fn>
  }
  let running: { stop: () => void } | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    deps = {
      getDb: vi.fn(() => fakeDb),
      createBackup: vi.fn().mockResolvedValue({ fileName: 'wedding-x.db', filePath: '/b/wedding-x.db', sizeBytes: 10 }),
      pruneBackups: vi.fn().mockReturnValue([]),
      sendAlert: vi.fn().mockResolvedValue('sent'),
      diskUsage: vi.fn().mockReturnValue(0.4),
    }
  })

  afterEach(() => {
    running?.stop()
    running = undefined
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const start = () => {
    running = startOpsScheduler({ ...deps, backupDir: '/data/backups' } as never)
    return running
  }

  it('sends a start notice and makes a first backup right away', async () => {
    start()
    await vi.advanceTimersByTimeAsync(0)

    expect(deps.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'app-started', cooldownMs: 15 * 60 * 1000 })
    )
    expect(deps.createBackup).toHaveBeenCalledTimes(1)
    expect(deps.createBackup).toHaveBeenCalledWith(fakeDb, '/data/backups', expect.any(Date))
    expect(deps.pruneBackups).toHaveBeenCalledWith('/data/backups')
  })

  it('repeats the backup every hour', async () => {
    start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS)

    expect(deps.createBackup).toHaveBeenCalledTimes(3)
  })

  it('alerts when a backup fails and keeps running', async () => {
    deps.createBackup.mockRejectedValueOnce(new Error('disk I/O error'))
    start()
    await vi.advanceTimersByTimeAsync(0)

    expect(deps.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'backup-failed', body: expect.stringContaining('disk I/O error') })
    )

    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS)
    expect(deps.createBackup).toHaveBeenCalledTimes(2)
  })

  it('does not prune after a failed backup', async () => {
    deps.createBackup.mockRejectedValueOnce(new Error('boom'))
    start()
    await vi.advanceTimersByTimeAsync(0)
    expect(deps.pruneBackups).not.toHaveBeenCalled()
  })

  it('alerts when the disk is at or above the threshold', async () => {
    deps.diskUsage.mockReturnValue(DISK_ALERT_THRESHOLD)
    start()
    await vi.advanceTimersByTimeAsync(0)

    expect(deps.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'disk-full', body: expect.stringContaining('85') })
    )
  })

  it('stays quiet below the threshold and checks again every ten minutes', async () => {
    start()
    await vi.advanceTimersByTimeAsync(0)
    expect(deps.sendAlert).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'disk-full' }))

    await vi.advanceTimersByTimeAsync(DISK_CHECK_INTERVAL_MS)
    expect(deps.diskUsage).toHaveBeenCalledTimes(2)
  })

  it('does not break when the disk check itself throws', async () => {
    deps.diskUsage.mockImplementation(() => {
      throw new Error('statfs unavailable')
    })
    start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(DISK_CHECK_INTERVAL_MS)

    expect(deps.createBackup).toHaveBeenCalled()
  })

  it('starts only once per process and stop() clears all timers', async () => {
    const first = start()
    const second = startOpsScheduler({ ...deps, backupDir: '/data/backups' } as never)
    expect(second).toBe(first)

    first.stop()
    running = undefined
    expect(vi.getTimerCount()).toBe(0)
  })
})
```

`src/instrumentation.test.ts` add (keep existing tests; `vi.stubEnv` and a mock of the scheduler module):

```ts
const startOpsScheduler = vi.fn()
vi.mock('@/lib/ops-scheduler', () => ({ startOpsScheduler: () => startOpsScheduler() }))

describe('register (ops scheduler)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    startOpsScheduler.mockClear()
  })

  function setRequiredEnv() {
    for (const key of ENV_KEYS) vi.stubEnv(key, 'test-value')
  }

  it('does not start the scheduler outside production', async () => {
    setRequiredEnv()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    register()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(startOpsScheduler).not.toHaveBeenCalled()
  })

  it('starts the scheduler in production on the Node runtime', async () => {
    setRequiredEnv()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    register()
    await vi.waitFor(() => expect(startOpsScheduler).toHaveBeenCalledTimes(1))
  })

  it('does not start the scheduler when a required variable is missing', async () => {
    setRequiredEnv()
    vi.stubEnv('ADMIN_PASSWORD', '')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    register()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(startOpsScheduler).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/ops-scheduler.test.ts src/instrumentation.test.ts`
Expected: FAIL (`./ops-scheduler` not found; scheduler never started).

- [ ] **Step 3: Implement**

`src/lib/ops-scheduler.ts`:

```ts
import { statfsSync } from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { getDb } from '@/lib/db'
import { createBackup, pruneBackups } from '@/lib/backup'
import { sendAlert } from '@/lib/alerts'

export const BACKUP_INTERVAL_MS = 60 * 60 * 1000
export const DISK_CHECK_INTERVAL_MS = 10 * 60 * 1000
export const DISK_ALERT_THRESHOLD = 0.85
const START_NOTICE_COOLDOWN_MS = 15 * 60 * 1000

export function diskUsageFraction(dir: string, statfs: typeof statfsSync = statfsSync): number {
  const stats = statfs(dir)
  if (!stats.blocks) return 0
  return (stats.blocks - stats.bavail) / stats.blocks
}

export interface SchedulerDeps {
  getDb?: () => Database.Database
  backupDir?: string
  createBackup?: typeof createBackup
  pruneBackups?: typeof pruneBackups
  sendAlert?: typeof sendAlert
  diskUsage?: (dir: string) => number
  now?: () => Date
}

export interface RunningScheduler {
  stop: () => void
}

declare global {
  var __opsScheduler: RunningScheduler | undefined
}

function defaultBackupDir(): string {
  const dbPath = process.env.DATABASE_PATH ?? 'data/wedding.db'
  return path.join(path.dirname(path.resolve(dbPath)), 'backups')
}

/**
 * Startet Backup- und Platten-Prüfung einmalig pro Prozess. Alle Timer sind
 * unref()ed; Fehler werden gemeldet (Log/E-Mail), brechen den Scheduler aber
 * nie ab.
 */
export function startOpsScheduler(deps: SchedulerDeps = {}): RunningScheduler {
  if (globalThis.__opsScheduler) return globalThis.__opsScheduler

  const resolveDb = deps.getDb ?? getDb
  const backupDir = deps.backupDir ?? defaultBackupDir()
  const doBackup = deps.createBackup ?? createBackup
  const doPrune = deps.pruneBackups ?? pruneBackups
  const alert = deps.sendAlert ?? sendAlert
  const diskUsage = deps.diskUsage ?? diskUsageFraction
  const now = deps.now ?? (() => new Date())

  const runBackup = async () => {
    try {
      const result = await doBackup(resolveDb(), backupDir, now())
      const removed = doPrune(backupDir)
      console.warn(`[backup] ok: ${result.fileName} (${result.sizeBytes} Bytes), ${removed.length} alte entfernt`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await alert({
        key: 'backup-failed',
        subject: 'Datenbank-Sicherung fehlgeschlagen',
        body: `Die stündliche Sicherung nach ${backupDir} ist fehlgeschlagen: ${message}`,
      })
    }
  }

  const runDiskCheck = () => {
    try {
      const used = diskUsage(path.dirname(backupDir))
      if (used >= DISK_ALERT_THRESHOLD) {
        void alert({
          key: 'disk-full',
          subject: 'Speicherplatz wird knapp',
          body: `Die Platte mit den Daten ist zu ${Math.round(used * 100)} % belegt (Schwelle ${Math.round(DISK_ALERT_THRESHOLD * 100)} %).`,
        })
      }
    } catch (error) {
      console.error(`[ops] Platten-Prüfung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  void alert({
    key: 'app-started',
    subject: 'App gestartet',
    body: `Die Hochzeitsseite wurde um ${now().toISOString()} gestartet.`,
    cooldownMs: START_NOTICE_COOLDOWN_MS,
  })
  void runBackup()
  runDiskCheck()

  const backupTimer = setInterval(() => void runBackup(), BACKUP_INTERVAL_MS)
  const diskTimer = setInterval(runDiskCheck, DISK_CHECK_INTERVAL_MS)
  backupTimer.unref?.()
  diskTimer.unref?.()

  const running: RunningScheduler = {
    stop: () => {
      clearInterval(backupTimer)
      clearInterval(diskTimer)
      globalThis.__opsScheduler = undefined
    },
  }
  globalThis.__opsScheduler = running
  return running
}
```

`src/instrumentation.ts`:

```ts
import { MissingEnvError, validateEnv } from '@/lib/env'

// Diese App läuft immer als eigenständiger Node-Server (Docker), nie auf
// Vercels Edge Runtime - process.exit() ist dort ohnehin nicht verfügbar.
export const runtime = 'nodejs'

async function startOpsInBackground(): Promise<void> {
  // Backup und Alarme nur im echten Server: nicht in Tests, nicht in dev.
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { startOpsScheduler } = await import('@/lib/ops-scheduler')
    startOpsScheduler()
  } catch (error) {
    console.error('Ops-Scheduler konnte nicht gestartet werden:', error)
  }
}

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
  void startOpsInBackground()
}
```

`.env.example` append:

```
# Optional - E-Mail-Alarme (Backup fehlgeschlagen, Platte voll, Start-Meldung).
# Ohne SMTP_HOST, SMTP_FROM und ALERT_EMAIL_TO wird nur ins Log geschrieben.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
ALERT_EMAIL_TO=
```

`README.md`: add the six variables to the env table (all "nein"; `SMTP_PORT` default 587; `ALERT_EMAIL_TO` comma-separated) and replace the "Backup" paragraph in "Betrieb" with:

```markdown
**Backup:** Die App sichert die Datenbank beim Start und danach stündlich nach
`data/backups/` (`wedding-YYYYMMDD-HHmmss.db`, UTC). Aufbewahrt werden die
letzten 48 Sicherungen plus die erste jedes Tages der letzten 30 Tage. Jede
Kopie wird mit `PRAGMA integrity_check` geprüft; schlägt das fehl, kommt ein
Alarm. Ab 85 % Plattenbelegung kommt ebenfalls ein Alarm. Alarme gehen ins
Log und, wenn `SMTP_*` und `ALERT_EMAIL_TO` gesetzt sind, per E-Mail (je
Anlass höchstens alle 6 Stunden). Die Start-Meldung beim Deploy zeigt, dass
der Mailversand funktioniert.

**Wiederherstellung:**

```bash
docker compose stop web
rm -f data/wedding.db-wal data/wedding.db-shm
cp data/backups/wedding-<Zeitstempel>.db data/wedding.db
docker compose start web
```

Die Sicherungen liegen auf derselben Platte wie die Datenbank – sie schützen
vor Fehlbedienung, **nicht** vor einem Plattenausfall. Eine Kopie auf ein
zweites System ist noch offen (`TODO.md`).
```

`TODO.md`: replace the "Betriebs-Härtung" bullet in "Noch zu planende Subsysteme" with:

```markdown
- Betriebs-Härtung, Rest: Off-Box-Kopie der Sicherungen (die stündliche
  lokale Sicherung mit Rotation, der Disk-Alarm und die E-Mail-Alarme sind
  gebaut) und ein externer Uptime-Monitor auf `/api/health`. Braucht vom
  Nutzer: ein Ziel für die Kopie (zweiter Server per rsync/SSH oder ein
  privater Objekt-Storage-Bucket) und einen Anbieter für den Monitor.
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run src/lib/ops-scheduler.test.ts src/instrumentation.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Verify the production build loads the scheduler**

Run: `npm run build 2>&1 | grep -iE "error|warn|Compiled"` and then start `npx next start -p 3199` with the env from `.env.local` plus a temporary `DATABASE_PATH=/tmp/ops-check/wedding.db`; after ~3 s expect a `data/backups`-style file `wedding-*.db` in `/tmp/ops-check/backups/` and a `[backup] ok` log line. Stop the server by its PID from `ss -ltnp`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ops-scheduler.ts src/lib/ops-scheduler.test.ts src/instrumentation.ts src/instrumentation.test.ts .env.example README.md TODO.md
git commit -m "Run hourly backups and disk/backup alarms from the production server"
```

---

### Task 6: Upload form — thumbnails in the list, timeout and cancel

**Files:**
- Modify: `src/components/gallery/GalleryUploadForm.tsx`
- Test: `src/components/gallery/GalleryUploadForm.test.tsx`

**Interfaces:**
- Consumes: `createThumbnailBlob`, `createPlaceholderThumbnailBlob` (unchanged signatures).
- Produces (module-internal): `uploadAndRegister(selected, ticket, uploaderName, control)` where `control = { signal: AbortSignal; onPreview: (blob: Blob, isPlaceholder: boolean) => void }` and result `{ photo, deleteToken } | { error: string } | { cancelled: true }`.

- [ ] **Step 1: Write the failing tests** — append to `GalleryUploadForm.test.tsx`

In the existing `createFakeBackend` helper make the PUT branch able to hang (add an option `hangPuts?: boolean`): when set, the R2 PUT branch returns

```ts
new Promise((_, reject) => {
  init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
})
```

and add a stub for object URLs in the file's `beforeEach`:

```ts
let objectUrlCounter = 0
const revoked: string[] = []
URL.createObjectURL = vi.fn(() => `blob:preview-${++objectUrlCounter}`)
URL.revokeObjectURL = vi.fn((url: string) => {
  revoked.push(url)
})
```

New tests:

```ts
it('shows a preview tile built from the generated thumbnail once a file is uploading', async () => {
  const user = setupUser()
  createFakeBackend()
  render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
  await user.type(screen.getByLabelText(/dein name/i), 'Anna')
  await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('a.jpg'))
  expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /hochladen/i }))

  await waitFor(() => expect(document.querySelector('img[src^="blob:preview-"]')).not.toBeNull())
})

it('shows a neutral icon instead of a picture when only a placeholder thumbnail exists', async () => {
  const user = setupUser()
  createFakeBackend()
  vi.mocked(createThumbnailBlob).mockRejectedValue(new Error('decode failed'))
  render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
  await user.type(screen.getByLabelText(/dein name/i), 'Anna')
  await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('IMG_1.heic', 'image/heic'))
  await user.click(screen.getByRole('button', { name: /hochladen/i }))

  await screen.findByText(/1 foto hochgeladen/i)
  expect(document.querySelector('img[src^="blob:preview-"]')).toBeNull()
  expect(screen.getByTestId('upload-preview-fallback')).toBeInTheDocument()
})

it('releases preview URLs when the selection is replaced and when the form unmounts', async () => {
  const user = setupUser()
  createFakeBackend()
  const { unmount } = render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
  await user.type(screen.getByLabelText(/dein name/i), 'Anna')
  await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('a.jpg'))
  await user.click(screen.getByRole('button', { name: /hochladen/i }))
  await screen.findByText(/1 foto hochgeladen/i)

  await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('b.jpg'))
  expect(revoked).toContain('blob:preview-1')

  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalled()
})

it('marks a file as failed with a timeout message after five minutes without progress', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ applyAccept: false, advanceTimers: vi.advanceTimersByTime })
  createFakeBackend({ hangPuts: true })
  render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
  await user.type(screen.getByLabelText(/dein name/i), 'Anna')
  await user.upload(screen.getByLabelText(/fotos ausw/i), makeFile('slow.jpg'))
  await user.click(screen.getByRole('button', { name: /hochladen/i }))

  await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1)

  expect(await screen.findByText(/zeitüberschreitung/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^hochladen$/i })).toBeEnabled()
  vi.useRealTimers()
})

it('cancels running uploads, starts no further group, and lets the files be uploaded again', async () => {
  const user = setupUser()
  const backend = createFakeBackend({ hangPuts: true })
  const files = Array.from({ length: 4 }, (_, i) => makeFile(`photo-${i}.jpg`))
  render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
  await user.type(screen.getByLabelText(/dein name/i), 'Anna')
  await user.upload(screen.getByLabelText(/fotos ausw/i), files)
  await user.click(screen.getByRole('button', { name: /hochladen/i }))
  await user.click(await screen.findByRole('button', { name: /abbrechen/i }))

  await waitFor(() => expect(screen.getByRole('button', { name: /^hochladen$/i })).toBeEnabled())
  // Nur die erste Gruppe (3 Dateien) hat Tickets bekommen, die vierte nie.
  expect(backend.requestBodies).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveTextContent(/abgebrochen/i)
  expect(screen.queryByText(/fehlgeschlagen/i)).not.toBeInTheDocument()
  expect(screen.getByLabelText(/fotos ausw/i)).toBeEnabled()
})

it('does not show the cancel button while idle', () => {
  render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /abbrechen/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/gallery/GalleryUploadForm.test.tsx`
Expected: FAIL (no preview tile, no cancel button, hanging PUT never ends).

- [ ] **Step 3: Implement** — changes in `GalleryUploadForm.tsx`

Imports: add `useEffect, useRef` to the React import, `ImageIcon, X` to the lucide import.

Constants and types:

```ts
// Ein einzelnes Foto darf höchstens so lange brauchen - danach gilt es als
// hängengeblieben (Funkloch, Tab im Hintergrund) und lässt sich erneut starten.
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000
const TIMEOUT_MESSAGE = 'Zeitüberschreitung – bitte erneut versuchen.'
const CANCELLED_MESSAGE = 'Abgebrochen.'
```

`SelectedFile` gets `previewUrl?: string | null` (string = Bild, `null` = Platzhalter-Symbol, `undefined` = noch keine Vorschau).

`UploadResult` becomes `{ photo; deleteToken } | { error: string } | { cancelled: true }`.

Replace `createThumbnailOrPlaceholder` and `uploadAndRegister`:

```ts
async function createThumbnailOrPlaceholder(file: File): Promise<{ blob: Blob; isPlaceholder: boolean }> {
  try {
    return { blob: await createThumbnailBlob(file), isPlaceholder: false }
  } catch {
    // Nicht dekodierbar (z. B. HEIC außerhalb von Safari): das Original
    // wird trotzdem hochgeladen, die Galerie zeigt eine neutrale Fläche.
    return { blob: await createPlaceholderThumbnailBlob(), isPlaceholder: true }
  }
}

interface UploadControl {
  /** Wird beim Klick auf "Abbrechen" ausgelöst. */
  signal: AbortSignal
  onPreview: (blob: Blob, isPlaceholder: boolean) => void
}

async function uploadAndRegister(
  selected: SelectedFile,
  ticket: UploadTicket,
  uploaderName: string,
  control: UploadControl
): Promise<UploadResult> {
  // Je Datei ein eigener Controller: er hängt am Abbrechen-Signal und am
  // Zeitlimit. (AbortSignal.any gibt es auf älteren iPhones noch nicht.)
  const fileController = new AbortController()
  let timedOut = false
  const onCancel = () => fileController.abort()
  control.signal.addEventListener('abort', onCancel)
  const timer = setTimeout(() => {
    timedOut = true
    fileController.abort()
  }, UPLOAD_TIMEOUT_MS)
  const { signal } = fileController

  try {
    const { blob, isPlaceholder } = await createThumbnailOrPlaceholder(selected.file)
    control.onPreview(blob, isPlaceholder)
    const [thumbResponse, originalResponse] = await Promise.all([
      fetch(ticket.thumbPutUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' }, signal }),
      fetch(ticket.originalPutUrl, {
        method: 'PUT',
        body: selected.file,
        headers: { 'Content-Type': selected.contentType },
        signal,
      }),
    ])
    if (!thumbResponse.ok || !originalResponse.ok) {
      return { error: 'Übertragung fehlgeschlagen.' }
    }
    const completeResponse = await fetch('/api/uploads/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: ticket.ticket, uploaderName }),
      signal,
    })
    if (!completeResponse.ok) {
      const body = await completeResponse.json().catch(() => null)
      return { error: body?.error ?? GENERIC_UPLOAD_ERROR }
    }
    return (await completeResponse.json()) as { photo: GalleryPhotoView; deleteToken: string }
  } catch {
    if (timedOut) return { error: TIMEOUT_MESSAGE }
    if (control.signal.aborted) return { cancelled: true }
    return { error: GENERIC_UPLOAD_ERROR }
  } finally {
    clearTimeout(timer)
    control.signal.removeEventListener('abort', onCancel)
  }
}
```

In the component:

```ts
const abortRef = useRef<AbortController | null>(null)
const previewUrlsRef = useRef<string[]>([])

const releasePreviews = () => {
  previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  previewUrlsRef.current = []
}

useEffect(() => releasePreviews, [])
```

`handleFilesChange` calls `releasePreviews()` before `setSelectedFiles(...)`.

`uploadOneFile(index, selected, ticket, signal)`:

```ts
updateFile(index, { status: 'uploading', message: undefined })
const result = await uploadAndRegister(selected, ticket, name.trim(), {
  signal,
  onPreview: (blob, isPlaceholder) => {
    if (isPlaceholder || typeof URL.createObjectURL !== 'function') {
      updateFile(index, { previewUrl: null })
      return
    }
    const url = URL.createObjectURL(blob)
    previewUrlsRef.current.push(url)
    updateFile(index, { previewUrl: url })
  },
})
if ('cancelled' in result) {
  updateFile(index, { status: 'pending', message: CANCELLED_MESSAGE })
  return
}
if ('error' in result) { …unchanged… }
```

`handleSubmit`: create `const controller = new AbortController(); abortRef.current = controller` before the loop; pass `controller.signal` to `requestTickets` (add as `signal` option of its `fetch`) and `uploadOneFile`; at the top of each loop iteration `if (controller.signal.aborted) break`; in `catch` ignore errors when `controller.signal.aborted` (no form error), in `finally` set `abortRef.current = null`.

`const cancelUpload = () => abortRef.current?.abort()`.

Render: in each list item, before the file name:

```tsx
{previewUrl !== undefined && (
  <span className="w-10 h-10 rounded-lg overflow-hidden bg-champagne/50 flex items-center justify-center flex-shrink-0">
    {previewUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={previewUrl} alt="" className="w-full h-full object-cover" />
    ) : (
      <ImageIcon size={16} className="text-gray-400" data-testid="upload-preview-fallback" />
    )}
  </span>
)}
```

(destructure `previewUrl` in the `.map`), show the message for a cancelled pending file in gray: `{status === 'pending' && message && <span className="text-gray-500">{message}</span>}`.

Summary: add `cancelledCount = selectedFiles.filter((f) => f.status === 'pending' && f.message === CANCELLED_MESSAGE).length` and a part `${pluralPhotos(cancelledCount, 'Foto', 'Fotos')} abgebrochen – tippe auf „Hochladen“, um sie erneut zu senden.`; the cancel button below the submit button, only while `submitting`:

```tsx
{submitting && (
  <Button type="button" variant="secondary" size="lg" onClick={cancelUpload} className="w-full">
    <X size={16} />
    Abbrechen
  </Button>
)}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run src/components/gallery && npm run typecheck && npm run lint`
Expected: PASS (the earlier tests in this file keep passing: `previewUrl` is `undefined` until a thumbnail exists).

- [ ] **Step 5: Commit**

```bash
git add src/components/gallery
git commit -m "Show upload previews and add timeout and cancel to the upload form"
```

---

### Task 7: 16 px text fields

**Files:**
- Create: `src/lib/form-styles.ts`
- Test: `src/lib/form-styles.test.ts`
- Modify: `src/app/memories/page.tsx`, `src/app/guestbook/page.tsx`, `src/app/gallery/page.tsx`, `src/components/gallery/GalleryUploadForm.tsx`, `src/components/admin/AdminLoginForm.tsx`, and every other file `grep` finds with that class string.

**Interfaces:**
- Produces: `textFieldClassName: string`.

- [ ] **Step 1: Write the failing test** — `src/lib/form-styles.test.ts`

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { textFieldClassName } from './form-styles'

const FILES_WITH_TEXT_FIELDS = [
  'src/app/memories/page.tsx',
  'src/app/guestbook/page.tsx',
  'src/app/gallery/page.tsx',
  'src/components/gallery/GalleryUploadForm.tsx',
  'src/components/admin/AdminLoginForm.tsx',
]

describe('text field styles', () => {
  it('uses 16 px text so iOS Safari does not zoom in when a field gets focus', () => {
    expect(textFieldClassName).toContain('text-base')
    expect(textFieldClassName).not.toMatch(/\btext-sm\b/)
  })

  it.each(FILES_WITH_TEXT_FIELDS)('%s uses the shared class instead of a 14 px copy', (file) => {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8')
    expect(source).toContain('textFieldClassName')
    expect(source).not.toContain('outline-none transition-colors text-sm')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/form-styles.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/lib/form-styles.ts`:

```ts
// 16 px (text-base): kleinere Schrift in einem Eingabefeld lässt iOS Safari
// beim Fokussieren die ganze Seite heranzoomen.
export const textFieldClassName =
  'w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-base'
```

Replace in every file from the list (and any further hit of `grep -rn "outline-none transition-colors text-sm" src`): the attribute `className="<old string>"` by `className={textFieldClassName}`, and `className="<old string> <extra>"` by `className={cn(textFieldClassName, '<extra>')}` (import `cn` from `@/lib/utils` where missing), plus `import { textFieldClassName } from '@/lib/form-styles'`. Do this with a small node script that asserts a replacement happened in each file, then check the diff by eye. The file input (`type="file"`, `className="w-full text-sm"`) is left alone: it does not trigger the iOS zoom.

- [ ] **Step 4: Run all tests, typecheck, lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "Use 16 px text fields to avoid the iOS focus zoom"
```

---

### Task 8: Collapsible admin sections

**Files:**
- Create: `src/components/admin/CollapsibleSection.tsx`
- Test: `src/components/admin/CollapsibleSection.test.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx`, `src/components/admin/AdminDashboard.test.tsx`

**Interfaces:**
- Produces: `<CollapsibleSection id title count? defaultOpen? children />` — renders a `<section aria-labelledby>`; the toggle is a button with `aria-expanded`/`aria-controls`; the panel stays mounted and is hidden with the `hidden` attribute.

- [ ] **Step 1: Write the failing tests**

`src/components/admin/CollapsibleSection.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import CollapsibleSection from './CollapsibleSection'

function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount((c) => c + 1)}>count {count}</button>
}

describe('CollapsibleSection', () => {
  it('is closed by default and exposes its state', () => {
    render(
      <CollapsibleSection id="demo" title="Gästebuch" count={3}>
        <p>Inhalt</p>
      </CollapsibleSection>
    )
    const toggle = screen.getByRole('button', { name: /gästebuch \(3\)/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Inhalt')).not.toBeVisible()
  })

  it('can start open', () => {
    render(
      <CollapsibleSection id="demo" title="Galerie" defaultOpen>
        <p>Inhalt</p>
      </CollapsibleSection>
    )
    expect(screen.getByRole('button', { name: /galerie/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Inhalt')).toBeVisible()
  })

  it('toggles on click and is a labelled region', async () => {
    render(
      <CollapsibleSection id="demo" title="Erinnerungen">
        <p>Inhalt</p>
      </CollapsibleSection>
    )
    await userEvent.click(screen.getByRole('button', { name: /erinnerungen/i }))

    expect(screen.getByText('Inhalt')).toBeVisible()
    expect(screen.getByRole('region', { name: /erinnerungen/i })).toBeInTheDocument()
  })

  it('keeps the state of its children while collapsed', async () => {
    render(
      <CollapsibleSection id="demo" title="Galerie" defaultOpen>
        <Counter />
      </CollapsibleSection>
    )
    await userEvent.click(screen.getByRole('button', { name: 'count 0' }))
    await userEvent.click(screen.getByRole('button', { name: /galerie/i }))
    await userEvent.click(screen.getByRole('button', { name: /galerie/i }))

    expect(screen.getByRole('button', { name: 'count 1' })).toBeInTheDocument()
  })
})
```

`AdminDashboard.test.tsx`: add a helper at the top of the describe block and use it in the tests that click delete buttons in the guestbook or memories list (the `löschen.*Anna` guestbook tests):

```ts
async function openSection(name: RegExp) {
  await userEvent.click(screen.getByRole('button', { name }))
}
```
and insert `await openSection(/gästebuch/i)` before the `getByRole('button', { name: /löschen.*Anna/i })` click in the two guestbook delete tests. Add:

```ts
it('starts with guestbook and memories collapsed and the gallery open', async () => {
  mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, noGalleryPhotos])
  render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)

  expect(screen.getByRole('button', { name: /^gästebuch/i })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('button', { name: /^erinnerungen/i })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('button', { name: /^galerie \(/i })).toHaveAttribute('aria-expanded', 'true')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/admin`
Expected: FAIL (`./CollapsibleSection` not found; no toggle buttons).

- [ ] **Step 3: Implement**

`src/components/admin/CollapsibleSection.tsx`:

```tsx
'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  id: string
  title: string
  count?: number
  defaultOpen?: boolean
  children: ReactNode
}

export default function CollapsibleSection({ id, title, count, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const headingId = `${id}-heading`
  const panelId = `${id}-panel`

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="font-serif text-lg font-semibold text-dark-blue mb-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 py-2 text-left"
        >
          <span>{count === undefined ? title : `${title} (${count})`}</span>
          <ChevronDown size={18} className={cn('flex-shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
      </h3>
      {/* hidden statt bedingtem Rendern: Formularzustand (z. B. laufende
          Uploads) darf beim Einklappen nicht verloren gehen. */}
      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </section>
  )
}
```

`AdminDashboard.tsx`: replace the three `<div><h3 …>…</h3>…</div>` / `<section aria-labelledby="admin-gallery-heading">` blocks by

```tsx
<CollapsibleSection id="admin-guestbook" title="Gästebuch" count={guestbookEntries.length}>
  …existing list markup…
</CollapsibleSection>
<CollapsibleSection id="admin-memories" title="Erinnerungen" count={memoryEntries.length}>
  …existing list markup…
</CollapsibleSection>
<CollapsibleSection id="admin-gallery" title="Galerie" count={galleryPhotos.length} defaultOpen>
  …existing gallery markup (form, delete error, grid)…
</CollapsibleSection>
```
(keep the inner markup unchanged; drop the old headings and the `aria-labelledby` section wrapper; add the import).

- [ ] **Step 4: Run all tests, typecheck, lint, build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin
git commit -m "Make the admin sections collapsible"
```

---

## Self-review

1. **Spec coverage:** Teil 1 → Tasks 1–2 (feature list, 423 enforcement incl. `complete`, `uploadsLocked`, dashboard row, hidden button + note, admin exempt). Teil 2 → Tasks 3–5 (backup module with integrity check and retention, alerts with persisted cool-down and start mail, scheduler with disk alarm, production-only start, README restore steps, env example, TODO off-box note). Teil 3 → Task 6 (previews from thumbnail, timeout 5 min, cancel), Task 7 (16 px), Task 8 (collapsible, gallery open).
2. **Placeholder scan:** no TBD; Task 7 Step 3 uses a script for a mechanical replace with an explicit assertion instead of listing ten near-identical edits.
3. **Type consistency:** `LOCKABLE_FEATURES`/`LockableFeature` (Task 1) used by Tasks 1–2; `UPLOADS_PAUSED_MESSAGE` defined in `gallery-upload-limits.ts`; `createBackup(db, dir, now)`/`pruneBackups(dir)` signatures match the scheduler's calls and test expectations; `sendAlert` option names `db/now/env/createTransport` match tests; `UploadControl`/`UploadResult` shapes are defined in Task 6 only.
4. **Review Focus:** upload lock vs. old tickets and admin (Task 1 tests); WAL copy readable and corrupt copy removed (Task 3 tests); SMTP failure swallowed, no cool-down on failure (Task 4); scheduler dev/test-off and single start (Task 5); cancel leaves `pending` + retry only unfinished (Task 6 + existing retry test); collapsed children stay mounted (Task 8 test).
