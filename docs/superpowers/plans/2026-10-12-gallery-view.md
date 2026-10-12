# Galerie-Ansicht (Raster, Filter, Lightbox) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baut die anzeigende Seite der Galerie: Kennwort-Gate, Kategorie-
Filter, Masonry-Raster und Vollbild-Lightbox mit Tastatur-Navigation und
Gast-Löschfunktion. Kein Upload-UI in diesem Plan (eigener Folge-Plan) —
diese Seite zeigt an, was bereits über die API/curl/Admin in der Galerie
liegt.

**Architecture:** Eine kleine Präsentationsschicht (`gallery-photo-view.ts`)
wandelt die internen `GalleryPhoto`-Objekte serverseitig in fertige
`thumbUrl`/`originalUrl`-URLs um, damit der Client nie rohe R2-Keys oder
die server-only `R2_PUBLIC_BASE_URL` sehen muss. Die Seite selbst ist rein
clientseitig (`'use client'`, Fetch-on-Mount, identisch zum Muster von
Gästebuch/Erinnerungen), Kategorie-Filterung passiert zu 100% im Browser
auf dem bereits geladenen Foto-Array. Lightbox und Raster sind eigene,
kleine Komponenten in einem neuen `src/components/gallery/`-Verzeichnis.

**Tech Stack:** Next.js App Router · React · TypeScript · Vitest + React
Testing Library · lucide-react (Icons).

**Spec:** `docs/superpowers/specs/2026-10-12-gallery-design.md`
(Abschnitte 4 „Galerie-Ansicht" und 7 „Bild-URLs für die Anzeige")

## Global Constraints

- Masonry per CSS `columns-2 md:columns-3 lg:columns-4 gap-4` +
  `break-inside-avoid` — exakt das bereits bei Erinnerungen etablierte
  Muster, keine neue Grid-Technik.
- Lightbox ist ein echtes Vollbild-Overlay (`fixed inset-0 z-50
  bg-black/95`), kein Card-Modal.
- Kategorie-Filter ist rein clientseitig (filtert das schon geladene
  Foto-Array) — löst **nie** einen erneuten `GET /api/gallery`-Call aus.
- `thumbUrl`/`originalUrl` (serverseitig aus `R2_PUBLIC_BASE_URL`
  gebaut) sind die einzige Bild-URL-Quelle für den Client — rohe
  `thumbKey`/`originalKey` dürfen in keiner API-Antwort mehr auftauchen,
  die der Client sieht.
- Löschen-Button-Sichtbarkeit basiert ausschließlich auf einem lokalen
  `localStorage`-Delete-Token-Lookup für genau diese Foto-ID — nie auf
  `uploaderName`-Abgleich oder einer anderen Heuristik.
- TDD Pflicht pro Funktion/Komponente: Test schreiben → rot sehen →
  minimal implementieren → grün.

## Review Focus

- Rohe `thumbKey`/`originalKey` dürfen in keiner Antwort von
  `GET /api/gallery` oder `POST /api/uploads/complete` auftauchen, die
  der Client je zu sehen bekommt.
- Beim Öffnen der Lightbox über ein Foto, während ein Kategorie-Filter
  aktiv ist, muss die Pfeil-Navigation innerhalb der **gefilterten**
  Foto-Liste bleiben, nicht im vollen, ungefilterten Array springen.
- Der Löschen-Button in der Lightbox darf **nur** erscheinen, wenn für
  genau diese Foto-ID ein Token in `localStorage` liegt — nie für fremde
  Fotos, auch wenn die Galerie öffentlich für alle sichtbar ist.
- Ein falsches Kennwort beim Entsperren muss eine Fehlermeldung zeigen,
  ohne dass das Raster je kurz aufblitzt (Status bleibt strikt
  „gesperrt", nie zwischenzeitlich „entsperrt").
- Tastatur-Navigation (←/→/Esc) darf nicht mehr reagieren, sobald die
  Lightbox geschlossen bzw. die Komponente entfernt wurde — kein
  verwaister `window`-Listener, der nach dem Schließen weiter feuert.

---

## Task 1: Bild-URL-Präsentationsschicht (Backend)

**Files:**
- Create: `src/lib/gallery-photo-view.ts`
- Test: `src/lib/gallery-photo-view.test.ts`
- Modify: `src/app/api/gallery/route.ts`
- Modify: `src/app/api/gallery/route.test.ts`
- Modify: `src/app/api/uploads/complete/route.ts`
- Modify: `src/app/api/uploads/complete/route.test.ts`

**Interfaces:**
- Consumes: `GalleryPhoto` (bestehend, `gallery-photos.ts`).
- Produces: `GalleryPhotoView` (Felder: `id`, `uploaderName`, `category`,
  `isOfficial`, `createdAt`, `thumbUrl`, `originalUrl` — **ohne**
  `thumbKey`/`originalKey`), `toGalleryPhotoView(photo: GalleryPhoto):
  GalleryPhotoView`. Von Task 4 und 5 (Frontend) konsumiert.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```ts
// src/lib/gallery-photo-view.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toGalleryPhotoView } from './gallery-photo-view'
import type { GalleryPhoto } from './gallery-photos'

describe('toGalleryPhotoView', () => {
  const originalBase = process.env.R2_PUBLIC_BASE_URL

  beforeEach(() => {
    process.env.R2_PUBLIC_BASE_URL = 'https://fotos.example.de'
  })

  afterEach(() => {
    process.env.R2_PUBLIC_BASE_URL = originalBase
  })

  it('builds absolute thumb/original URLs and drops the raw keys', () => {
    const photo: GalleryPhoto = {
      id: 'p1',
      thumbKey: 'gallery/p1/thumb.jpg',
      originalKey: 'gallery/p1/original.jpg',
      uploaderName: 'Anna',
      category: 'Hochzeit',
      isOfficial: false,
      createdAt: '2026-10-12T10:00:00.000Z',
    }

    const view = toGalleryPhotoView(photo)

    expect(view).toEqual({
      id: 'p1',
      uploaderName: 'Anna',
      category: 'Hochzeit',
      isOfficial: false,
      createdAt: '2026-10-12T10:00:00.000Z',
      thumbUrl: 'https://fotos.example.de/gallery/p1/thumb.jpg',
      originalUrl: 'https://fotos.example.de/gallery/p1/original.jpg',
    })
    expect(view).not.toHaveProperty('thumbKey')
    expect(view).not.toHaveProperty('originalKey')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/gallery-photo-view.test.ts`
Expected: FAIL — `Failed to resolve import "./gallery-photo-view"`

- [ ] **Step 3: `gallery-photo-view.ts` implementieren**

```ts
// src/lib/gallery-photo-view.ts
import type { GalleryPhoto } from './gallery-photos'

export interface GalleryPhotoView {
  id: string
  uploaderName: string
  category: string
  isOfficial: boolean
  createdAt: string
  thumbUrl: string
  originalUrl: string
}

export function toGalleryPhotoView(photo: GalleryPhoto): GalleryPhotoView {
  const base = process.env.R2_PUBLIC_BASE_URL ?? ''
  return {
    id: photo.id,
    uploaderName: photo.uploaderName,
    category: photo.category,
    isOfficial: photo.isOfficial,
    createdAt: photo.createdAt,
    thumbUrl: `${base}/${photo.thumbKey}`,
    originalUrl: `${base}/${photo.originalKey}`,
  }
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/gallery-photo-view.test.ts`
Expected: PASS (1/1)

- [ ] **Step 5: Fehlschlagenden Test für `GET /api/gallery` ergänzen**

```ts
// src/app/api/gallery/route.test.ts - ergänzen: Import, beforeEach/afterEach
// um R2_PUBLIC_BASE_URL erweitern, und einen neuen Test hinzufügen.
// Am Dateianfang zusätzlich importieren:
// import { afterEach, beforeEach, describe, expect, it } from 'vitest' (schon vorhanden)

// In beforeEach ergänzen:
//   process.env.R2_PUBLIC_BASE_URL = 'https://fotos.example.de'
// In afterEach ergänzen (originalBase vorher wie process.env.DATABASE_PATH
// am Dateianfang als const sichern):
//   process.env.R2_PUBLIC_BASE_URL = originalR2Base

// Neuer Test, in der describe('GET /api/gallery', ...)-Gruppe ergänzt:
it('returns thumbUrl/originalUrl instead of raw storage keys', async () => {
  const db = getDb()
  addGalleryPhoto(db, {
    id: 'p1',
    thumbKey: 'gallery/p1/thumb.jpg',
    originalKey: 'gallery/p1/original.jpg',
    uploaderName: 'Anna',
    deleteTokenHash: 'h1',
    category: 'Hochzeit',
    isOfficial: false,
  })

  const body = await (await GET(requestWithCookies({}))).json()
  expect(body.photos[0].thumbUrl).toBe('https://fotos.example.de/gallery/p1/thumb.jpg')
  expect(body.photos[0].originalUrl).toBe('https://fotos.example.de/gallery/p1/original.jpg')
  expect(body.photos[0]).not.toHaveProperty('thumbKey')
  expect(body.photos[0]).not.toHaveProperty('originalKey')
})
```

Konkret anzuwendender Patch auf die bestehende Datei (Kopf der
`describe`-Gruppe):

```ts
describe('GET /api/gallery', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalR2Base = process.env.R2_PUBLIC_BASE_URL

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.R2_PUBLIC_BASE_URL = 'https://fotos.example.de'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    process.env.R2_PUBLIC_BASE_URL = originalR2Base
  })
  // ... bestehende Tests unverändert, neuer Test wie oben ergänzt
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/gallery/route.test.ts`
Expected: FAIL — der neue Test erwartet `thumbUrl`, die Route liefert
noch `thumbKey` (`undefined` statt der erwarteten URL)

- [ ] **Step 7: `GET /api/gallery` anpassen**

```ts
// src/app/api/gallery/route.ts (vollständige neue Fassung)
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { getGalleryMode } from '@/lib/gallery-mode'
import { isGalleryUnlocked } from '@/lib/gallery-auth'
import { listGalleryPhotos } from '@/lib/gallery-photos'
import { toGalleryPhotoView } from '@/lib/gallery-photo-view'

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  const mode = getGalleryMode(db)

  const canSeePhotos = mode === 'public' || isAdminRequest(request, db) || isGalleryUnlocked(request, db)
  if (!canSeePhotos) {
    return NextResponse.json({ mode, unlocked: false, photos: null })
  }

  return NextResponse.json({
    mode,
    unlocked: true,
    photos: listGalleryPhotos(db).map(toGalleryPhotoView),
  })
}
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/gallery/route.test.ts`
Expected: PASS (6/6)

- [ ] **Step 9: Fehlschlagenden Test für `/api/uploads/complete` ergänzen**

```ts
// src/app/api/uploads/complete/route.test.ts - neuer Test, ergänzt in der
// describe('POST /api/uploads/complete', ...)-Gruppe:
it('returns thumbUrl/originalUrl instead of raw storage keys', async () => {
  const db = getDb()
  const secret = getOrCreateAdminSecret(db)
  const ticket = signUploadTicket(validPayload(), secret)
  mockHeadObject.mockImplementation(async (key: string) =>
    key.includes('thumb') ? { size: 100_000 } : { size: 4_000_000 }
  )

  const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
  const body = await response.json()
  expect(body.photo.thumbUrl).toContain('/gallery/photo-1/thumb.jpg')
  expect(body.photo.originalUrl).toContain('/gallery/photo-1/original.jpg')
  expect(body.photo).not.toHaveProperty('thumbKey')
  expect(body.photo).not.toHaveProperty('originalKey')
})
```

- [ ] **Step 10: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/uploads/complete/route.test.ts`
Expected: FAIL — `body.photo.thumbUrl` ist `undefined`, die Route liefert
noch das rohe `GalleryPhoto`-Objekt mit `thumbKey`/`originalKey`

- [ ] **Step 11: `/api/uploads/complete` anpassen**

```ts
// src/app/api/uploads/complete/route.ts - Import ergänzen und den
// Rückgabe-Aufruf anpassen, Rest der Datei unverändert:
import { toGalleryPhotoView } from '@/lib/gallery-photo-view'

// ... am Ende von POST:
  return NextResponse.json({ photo: toGalleryPhotoView(photo), deleteToken }, { status: 201 })
```

- [ ] **Step 12: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/uploads/complete/route.test.ts`
Expected: PASS (7/7)

- [ ] **Step 13: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 14: Commit**

```bash
git add src/lib/gallery-photo-view.ts src/lib/gallery-photo-view.test.ts \
  src/app/api/gallery/route.ts src/app/api/gallery/route.test.ts \
  src/app/api/uploads/complete/route.ts src/app/api/uploads/complete/route.test.ts
git commit -m "Return computed photo URLs instead of raw R2 storage keys"
```

---

## Task 2: Client-seitiger Lösch-Token-Speicher

**Files:**
- Create: `src/lib/gallery-delete-tokens.ts`
- Test: `src/lib/gallery-delete-tokens.test.ts`

**Interfaces:**
- Produces: `saveDeleteToken(photoId: string, token: string): void`,
  `getDeleteToken(photoId: string): string | undefined`,
  `removeDeleteToken(photoId: string): void`. Von Task 3 konsumiert.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```ts
// src/lib/gallery-delete-tokens.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { saveDeleteToken, getDeleteToken, removeDeleteToken } from './gallery-delete-tokens'

describe('gallery delete tokens', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('returns undefined for a photo with no saved token', () => {
    expect(getDeleteToken('unknown-id')).toBeUndefined()
  })

  it('saves and retrieves a token for a specific photo', () => {
    saveDeleteToken('photo-1', 'token-abc')
    expect(getDeleteToken('photo-1')).toBe('token-abc')
  })

  it('keeps tokens for different photos independent', () => {
    saveDeleteToken('photo-1', 'token-1')
    saveDeleteToken('photo-2', 'token-2')
    expect(getDeleteToken('photo-1')).toBe('token-1')
    expect(getDeleteToken('photo-2')).toBe('token-2')
  })

  it('removes a token, after which it is no longer returned', () => {
    saveDeleteToken('photo-1', 'token-1')
    removeDeleteToken('photo-1')
    expect(getDeleteToken('photo-1')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/gallery-delete-tokens.test.ts`
Expected: FAIL — `Failed to resolve import "./gallery-delete-tokens"`

- [ ] **Step 3: `gallery-delete-tokens.ts` implementieren**

```ts
// src/lib/gallery-delete-tokens.ts
const STORAGE_KEY = 'gallery-delete-tokens'

function loadDeleteTokens(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveDeleteToken(photoId: string, token: string): void {
  try {
    const tokens = loadDeleteTokens()
    tokens[photoId] = token
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch {
    // localStorage kann in seltenen Fällen fehlschlagen - das Foto ist
    // serverseitig trotzdem gespeichert, nur lokal nicht als "eigenes"
    // erkennbar (kein Löschen-Button, aber kein Datenverlust).
  }
}

export function getDeleteToken(photoId: string): string | undefined {
  return loadDeleteTokens()[photoId]
}

export function removeDeleteToken(photoId: string): void {
  try {
    const tokens = loadDeleteTokens()
    delete tokens[photoId]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch {
    // s.o.
  }
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/gallery-delete-tokens.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/lib/gallery-delete-tokens.ts src/lib/gallery-delete-tokens.test.ts
git commit -m "Add client-side delete-token storage for gallery uploads"
```

---

## Task 3: `GalleryLightbox`-Komponente

**Files:**
- Create: `src/components/gallery/GalleryLightbox.tsx`
- Test: `src/components/gallery/GalleryLightbox.test.tsx`

**Interfaces:**
- Consumes: `GalleryPhotoView` (Task 1), `getDeleteToken`,
  `removeDeleteToken` (Task 2).
- Produces: `<GalleryLightbox photos={GalleryPhotoView[]} index={number}
  onClose={() => void} onNavigate={(nextIndex: number) => void}
  onDeleted={(photoId: string) => void} />`. Von Task 4 konsumiert.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```tsx
// src/components/gallery/GalleryLightbox.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import GalleryLightbox from './GalleryLightbox'
import { saveDeleteToken } from '@/lib/gallery-delete-tokens'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'

function photo(overrides: Partial<GalleryPhotoView> = {}): GalleryPhotoView {
  return {
    id: 'p1',
    uploaderName: 'Anna',
    category: 'Hochzeit',
    isOfficial: false,
    createdAt: '2026-10-12T10:00:00.000Z',
    thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
    originalUrl: 'https://fotos.example.de/p1/original.jpg',
    ...overrides,
  }
}

describe('GalleryLightbox', () => {
  afterEach(() => {
    window.localStorage.clear()
    cleanup()
  })

  it('does not show a delete button when there is no saved token for this photo', () => {
    render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    expect(screen.queryByRole('button', { name: /löschen/i })).not.toBeInTheDocument()
  })

  it('shows a delete button when a saved token exists for this photo', () => {
    saveDeleteToken('p1', 'secret-token')
    render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /löschen/i })).toBeInTheDocument()
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={onClose} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigates to the next photo, wrapping around to the first', () => {
    const onNavigate = vi.fn()
    render(
      <GalleryLightbox
        photos={[photo({ id: 'p1' }), photo({ id: 'p2' })]}
        index={1}
        onClose={vi.fn()}
        onNavigate={onNavigate}
        onDeleted={vi.fn()}
      />
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('navigates to the previous photo', () => {
    const onNavigate = vi.fn()
    render(
      <GalleryLightbox
        photos={[photo({ id: 'p1' }), photo({ id: 'p2' })]}
        index={1}
        onClose={vi.fn()}
        onNavigate={onNavigate}
        onDeleted={vi.fn()}
      />
    )
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('stops reacting to keyboard events after being unmounted', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={onClose} onNavigate={vi.fn()} onDeleted={vi.fn()} />
    )
    unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('deletes the photo and calls onDeleted when the server confirms', async () => {
    saveDeleteToken('p1', 'secret-token')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const onDeleted = vi.fn()

    render(
      <GalleryLightbox photos={[photo()]} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDeleted={onDeleted} />
    )
    fireEvent.click(screen.getByRole('button', { name: /löschen/i }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('p1'))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/gallery/p1',
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ deleteToken: 'secret-token' }) })
    )
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/gallery/GalleryLightbox.test.tsx`
Expected: FAIL — `Failed to resolve import "./GalleryLightbox"`

- [ ] **Step 3: `GalleryLightbox.tsx` implementieren**

```tsx
// src/components/gallery/GalleryLightbox.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'
import { getDeleteToken, removeDeleteToken } from '@/lib/gallery-delete-tokens'

interface GalleryLightboxProps {
  photos: GalleryPhotoView[]
  index: number
  onClose: () => void
  onNavigate: (nextIndex: number) => void
  onDeleted: (photoId: string) => void
}

export default function GalleryLightbox({ photos, index, onClose, onNavigate, onDeleted }: GalleryLightboxProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const photo = photos[index]
  const deleteToken = photo ? getDeleteToken(photo.id) : undefined

  const goTo = useCallback(
    (direction: 'prev' | 'next') => {
      if (photos.length === 0) return
      const nextIndex =
        direction === 'prev' ? (index - 1 + photos.length) % photos.length : (index + 1) % photos.length
      onNavigate(nextIndex)
    },
    [index, photos.length, onNavigate]
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goTo('prev')
      if (e.key === 'ArrowRight') goTo('next')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, goTo])

  if (!photo) return null

  const handleDelete = async () => {
    if (!deleteToken) return
    setDeleteError(null)
    setDeleting(true)
    try {
      const response = await fetch(`/api/gallery/${photo.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteToken }),
      })
      if (!response.ok) {
        setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
        return
      }
      removeDeleteToken(photo.id)
      onDeleted(photo.id)
    } catch {
      setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Schließen"
      >
        <X size={20} />
      </button>

      {photos.length > 1 && (
        <>
          <button
            className="absolute left-4 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              goTo('prev')
            }}
            aria-label="Vorheriges Bild"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            className="absolute right-4 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              goTo('next')
            }}
            aria-label="Nächstes Bild"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <div className="max-w-5xl max-h-[85vh] mx-8" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.originalUrl}
          alt={`Foto von ${photo.uploaderName}`}
          className="max-h-[80vh] w-auto h-auto object-contain rounded-lg mx-auto"
        />
        <div className="text-center mt-3 flex items-center justify-center gap-4">
          <a href={photo.originalUrl} download className="text-white/70 text-sm hover:text-white transition-colors">
            Original herunterladen
          </a>
          {deleteToken && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-white/70 text-sm hover:text-red-400 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {deleting ? 'Wird gelöscht...' : 'Löschen'}
            </button>
          )}
        </div>
        {deleteError && <p className="text-red-400 text-sm text-center mt-2">{deleteError}</p>}
        <p className="text-white/40 text-xs mt-1 text-center">
          {index + 1} / {photos.length}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/gallery/GalleryLightbox.test.tsx`
Expected: PASS (7/7)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/components/gallery/GalleryLightbox.tsx src/components/gallery/GalleryLightbox.test.tsx
git commit -m "Add the full-screen gallery lightbox with keyboard nav and delete"
```

---

## Task 4: `GalleryGrid`-Komponente

**Files:**
- Create: `src/components/gallery/GalleryGrid.tsx`
- Test: `src/components/gallery/GalleryGrid.test.tsx`

**Interfaces:**
- Consumes: `GalleryPhotoView` (Task 1), `galleryCategories` (bestehend,
  `gallery-categories.ts`), `GalleryLightbox` (Task 3), `cn` (bestehend,
  `utils.ts`).
- Produces: `<GalleryGrid photos={GalleryPhotoView[]} onPhotoDeleted=
  {(photoId: string) => void} />`. Von Task 5 konsumiert.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```tsx
// src/components/gallery/GalleryGrid.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import GalleryGrid from './GalleryGrid'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'

function photo(overrides: Partial<GalleryPhotoView> = {}): GalleryPhotoView {
  return {
    id: 'p1',
    uploaderName: 'Anna',
    category: 'Hochzeit',
    isOfficial: false,
    createdAt: '2026-10-12T10:00:00.000Z',
    thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
    originalUrl: 'https://fotos.example.de/p1/original.jpg',
    ...overrides,
  }
}

describe('GalleryGrid', () => {
  afterEach(() => cleanup())

  it('shows an empty-state message when there are no photos at all', () => {
    render(<GalleryGrid photos={[]} onPhotoDeleted={vi.fn()} />)
    expect(screen.getByText(/noch keine fotos/i)).toBeInTheDocument()
  })

  it('renders a thumbnail for every photo', () => {
    render(<GalleryGrid photos={[photo({ id: 'p1' }), photo({ id: 'p2' })]} onPhotoDeleted={vi.fn()} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('filters the grid by category when a chip is clicked', () => {
    render(
      <GalleryGrid
        photos={[photo({ id: 'p1', category: 'Hochzeit' }), photo({ id: 'p2', category: 'Party' })]}
        onPhotoDeleted={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^party/i }))
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('shows a category-specific empty state when the active category has no photos', () => {
    render(<GalleryGrid photos={[photo({ id: 'p1', category: 'Hochzeit' })]} onPhotoDeleted={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^party/i }))
    expect(screen.getByText(/keine fotos in dieser kategorie/i)).toBeInTheDocument()
  })

  it('opens the lightbox for the clicked photo within the filtered set', async () => {
    render(
      <GalleryGrid
        photos={[photo({ id: 'p1', category: 'Hochzeit' }), photo({ id: 'p2', category: 'Party' })]}
        onPhotoDeleted={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^party/i }))
    fireEvent.click(screen.getByRole('img', { name: /foto von anna/i }))
    expect(await screen.findByText('1 / 1')).toBeInTheDocument()
  })

  it('removes a deleted photo from the grid once the parent re-renders without it', () => {
    const { rerender } = render(
      <GalleryGrid photos={[photo({ id: 'p1' }), photo({ id: 'p2' })]} onPhotoDeleted={vi.fn()} />
    )
    rerender(<GalleryGrid photos={[photo({ id: 'p2' })]} onPhotoDeleted={vi.fn()} />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/gallery/GalleryGrid.test.tsx`
Expected: FAIL — `Failed to resolve import "./GalleryGrid"`

- [ ] **Step 3: `GalleryGrid.tsx` implementieren**

```tsx
// src/components/gallery/GalleryGrid.tsx
'use client'

import { useState } from 'react'
import { ZoomIn } from 'lucide-react'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'
import { galleryCategories } from '@/lib/gallery-categories'
import { cn } from '@/lib/utils'
import GalleryLightbox from './GalleryLightbox'

interface GalleryGridProps {
  photos: GalleryPhotoView[]
  onPhotoDeleted: (photoId: string) => void
}

export default function GalleryGrid({ photos, onPhotoDeleted }: GalleryGridProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Alle')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const filteredPhotos = activeCategory === 'Alle' ? photos : photos.filter((p) => p.category === activeCategory)

  const handleDeleted = (photoId: string) => {
    onPhotoDeleted(photoId)
    setLightboxIndex(null)
  }

  if (photos.length === 0) {
    return <p className="text-center text-gray-400 py-16">Noch keine Fotos – lade das erste hoch!</p>
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        <button
          type="button"
          onClick={() => setActiveCategory('Alle')}
          className={cn(
            'px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
            activeCategory === 'Alle'
              ? 'bg-dark-blue text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-champagne hover:text-dark-blue'
          )}
        >
          Alle
          <span className="ml-1.5 text-xs opacity-60">({photos.length})</span>
        </button>
        {galleryCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={cn(
              'px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
              activeCategory === category
                ? 'bg-dark-blue text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-champagne hover:text-dark-blue'
            )}
          >
            {category}
            <span className="ml-1.5 text-xs opacity-60">
              ({photos.filter((p) => p.category === category).length})
            </span>
          </button>
        ))}
      </div>

      {filteredPhotos.length === 0 ? (
        <p className="text-center text-gray-400 py-16">Keine Fotos in dieser Kategorie.</p>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
          {filteredPhotos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="block w-full mb-4 break-inside-avoid relative overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt={`Foto von ${photo.uploaderName}`}
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-dark-blue/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <ZoomIn size={28} className="text-white" />
              </div>
              <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="inline-block bg-white/90 text-dark-blue text-xs font-medium px-2 py-1 rounded-full">
                  {photo.isOfficial ? photo.category : `Von ${photo.uploaderName}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <GalleryLightbox
          photos={filteredPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/gallery/GalleryGrid.test.tsx`
Expected: PASS (6/6)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/components/gallery/GalleryGrid.tsx src/components/gallery/GalleryGrid.test.tsx
git commit -m "Add the gallery masonry grid with category filter chips"
```

---

## Task 5: Galerie-Seite (Kennwort-Gate + Zusammenbau)

**Files:**
- Create: `src/app/gallery/page.tsx`
- Test: `src/app/gallery/page.test.tsx`

**Interfaces:**
- Consumes: `GET /api/gallery`, `POST /api/gallery/unlock` (bestehend),
  `GalleryGrid` (Task 4), `GalleryPhotoView` (Task 1), `Card`, `Button`,
  `SectionTitle` (bestehend, `components/ui`).
- Produces: `/gallery`-Seite — Endpunkt dieses Plans, von keinem
  weiteren Task in diesem Plan konsumiert.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```tsx
// src/app/gallery/page.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GalleryPage from './page'

function mockFetchSequence(responses: { status?: number; body: unknown }[]) {
  const fn = vi.fn()
  responses.forEach(({ status = 200, body }) => {
    fn.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const samplePhoto = {
  id: 'p1',
  uploaderName: 'Anna',
  category: 'Hochzeit',
  isOfficial: false,
  createdAt: '2026-10-12T10:00:00.000Z',
  thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
  originalUrl: 'https://fotos.example.de/p1/original.jpg',
}

describe('GalleryPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the gallery grid directly when the gallery is public', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [samplePhoto] } }])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
  })

  it('shows the password form when the gallery is locked', async () => {
    mockFetchSequence([{ body: { mode: 'password', unlocked: false, photos: null } }])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())
  })

  it('shows the gallery after a successful unlock', async () => {
    const fetchMock = mockFetchSequence([
      { body: { mode: 'password', unlocked: false, photos: null } },
      { body: { success: true } },
      { body: { mode: 'password', unlocked: true, photos: [samplePhoto] } },
    ])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/kennwort/i), 'empfang-secret')
    await userEvent.click(screen.getByRole('button', { name: /galerie ansehen/i }))

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('shows an error and stays locked when the password is wrong', async () => {
    mockFetchSequence([
      { body: { mode: 'password', unlocked: false, photos: null } },
      { status: 401, body: { error: 'Falsches Kennwort.' } },
    ])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/kennwort/i), 'falsch')
    await userEvent.click(screen.getByRole('button', { name: /galerie ansehen/i }))

    await waitFor(() => expect(screen.getByText('Falsches Kennwort.')).toBeInTheDocument())
    expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [] } }])
    const { container } = render(<GalleryPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pt-24'))
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/gallery/page.test.tsx`
Expected: FAIL — `Failed to resolve import "./page"` (Datei existiert
noch nicht)

- [ ] **Step 3: `page.tsx` implementieren**

```tsx
// src/app/gallery/page.tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import GalleryGrid from '@/components/gallery/GalleryGrid'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'

type GalleryData =
  | { status: 'loading' }
  | { status: 'locked' }
  | { status: 'unlocked'; photos: GalleryPhotoView[] }

export default function GalleryPage() {
  const [data, setData] = useState<GalleryData>({ status: 'loading' })
  const [password, setPassword] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  const loadGallery = () => {
    fetch('/api/gallery')
      .then((res) => (res.ok ? res.json() : { unlocked: false, photos: null }))
      .then((body: { unlocked: boolean; photos: GalleryPhotoView[] | null }) => {
        setData(body.unlocked && body.photos ? { status: 'unlocked', photos: body.photos } : { status: 'locked' })
      })
      .catch(() => setData({ status: 'locked' }))
  }

  useEffect(() => {
    loadGallery()
  }, [])

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault()
    setUnlockError(null)
    setUnlocking(true)
    try {
      const response = await fetch('/api/gallery/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setUnlockError(body?.error ?? 'Falsches Kennwort.')
        return
      }
      setPassword('')
      loadGallery()
    } catch {
      setUnlockError('Entsperren fehlgeschlagen. Bitte versuch es erneut.')
    } finally {
      setUnlocking(false)
    }
  }

  const handlePhotoDeleted = (photoId: string) => {
    setData((prev) =>
      prev.status === 'unlocked' ? { status: 'unlocked', photos: prev.photos.filter((p) => p.id !== photoId) } : prev
    )
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionTitle title="Galerie" subtitle="Momente, die wir für immer in Erinnerung behalten." />

        {data.status === 'locked' && (
          <Card padding="lg" className="max-w-md mx-auto">
            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label htmlFor="gallery-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Kennwort
                </label>
                <input
                  id="gallery-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kennwort"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                />
              </div>
              {unlockError && <p className="text-sm text-red-600">{unlockError}</p>}
              <Button type="submit" size="lg" disabled={unlocking} className="w-full">
                {unlocking ? 'Wird geprüft...' : 'Galerie ansehen'}
              </Button>
            </form>
          </Card>
        )}

        {data.status === 'unlocked' && <GalleryGrid photos={data.photos} onPhotoDeleted={handlePhotoDeleted} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/gallery/page.test.tsx`
Expected: PASS (5/5)

- [ ] **Step 5: Gesamte Toolchain inklusive Build prüfen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün

- [ ] **Step 6: Commit**

```bash
git add src/app/gallery/page.tsx src/app/gallery/page.test.tsx
git commit -m "Add the gallery page with the password gate and photo grid"
```

---

## Abschluss

Nach Task 5 zeigt `/gallery` ein Kategorie-filterbares Masonry-Raster mit
Vollbild-Lightbox, respektiert den Kennwort-Gate-Status aus dem Backend
und lässt Gäste ihre eigenen Fotos direkt aus der Lightbox löschen. Das
Hochladen selbst (Formular, Client-seitige Thumbnail-Erzeugung,
Admin-Upload-Weg, Admin-Dashboard-Erweiterung) ist ein eigener
Folge-Plan, der auf `GalleryGrid`/`GalleryLightbox` und den hier
eingeführten `GalleryPhotoView`-Vertrag aufbaut.
