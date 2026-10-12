# Galerie-Upload & Admin-Erweiterung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schließt die Galerie ab: Gäste können Fotos hochladen (Kategorie-
Auswahl, client-seitige Thumbnail-Erzeugung, Fortschritt pro Datei), Admin
kann denselben Weg ohne Kennwort nutzen (offizielle Fotos) sowie die
Galerie-Sichtbarkeit umschalten und Fotos über eine Lösch-Liste verwalten.

**Architecture:** Eine einzige `GalleryUploadForm`-Komponente bedient
sowohl Gäste (Kennwort-Pflicht) als auch Admin (`isAdmin`-Prop, kein
Kennwort-Feld, `isOfficial` kommt serverseitig aus dem bereits
bestehenden Admin-Cookie-Check) — kein zweites, paralleles Formular. Der
Upload-Ablauf (Ticket anfragen → Thumbnail im Browser erzeugen →
parallel zu R2 hochladen → bestätigen) nutzt ausschließlich die bereits
gebauten Backend-Routen. Die Admin-Dashboard-Erweiterung fügt sich in die
bestehende Struktur ein (Card mit den drei Schreib-Sperren-Schaltern
bekommt eine vierte Zeile; die Fetch-on-Mount-Liste bekommt eine dritte
parallele Abfrage).

**Tech Stack:** Next.js App Router · React 19 · TypeScript · Vitest + React
Testing Library · lucide-react (Icons) · Canvas/`createImageBitmap`
(client-seitige Bildverarbeitung, kein zusätzliches Paket).

**Spec:** `docs/superpowers/specs/2026-10-12-gallery-design.md`
(Abschnitte 5 „Upload-UI" und 6 „Admin-Erweiterung (Frontend)")

## Global Constraints

- Eine Komponente (`GalleryUploadForm`) für Gast- und Admin-Upload,
  unterschieden durch die `isAdmin`-Prop — kein zweites Formular.
- `isOfficial` wird (wie im Backend bereits entschieden) nie vom Client
  gesetzt — der Admin-Weg schickt einfach kein `password`-Feld, der
  Server leitet `isOfficial` aus dem Admin-Cookie ab.
- Thumbnail-Erzeugung: `createImageBitmap` mit
  `imageOrientation: 'from-image'`, zweistufiges Downscaling (sichere
  Zwischengröße, dann Zielgröße) gegen Mobile Safaris Canvas-Flächenlimit,
  Export als JPEG über `canvas.toBlob`.
- Datei-Status pro Foto ist einer von `'pending' | 'uploading' | 'done' |
  'error'` — bewusst **ohne** Prozent-Fortschrittsbalken: `fetch` bietet
  keine Upload-Fortschritts-Events (dafür bräuchte es `XMLHttpRequest`
  statt `fetch`), das wäre ein eigenes, größeres Stück Arbeit. Ein
  Status-Icon pro Datei ist der bewusst einfachere Kompromiss für diesen
  Plan.
- Interaktive Elemente (Lösch-Buttons etc.) dürfen **nicht** ausschließlich
  per `group-hover` sichtbar sein — gilt jetzt auch für die neue
  Admin-Lösch-Liste, nicht nur für die bereits im letzten Review
  korrigierte Gast-Galerie.
- TDD Pflicht pro Funktion/Komponente: Test schreiben → rot sehen →
  minimal implementieren → grün.

## Review Focus

- Ein Admin-Upload darf **nie** ein `password`-Feld im Request-Body
  brauchen oder zeigen — die Kennwort-Pflicht gilt ausschließlich für
  Gäste.
- Scheitert der Upload **einer** Datei in einem Mehrfach-Upload (z. B.
  `complete` schlägt fehl), dürfen die anderen Dateien im selben Batch
  nicht ebenfalls als fehlgeschlagen markiert werden — jede Datei hat
  ihren eigenen Status.
- Der neu hochgeladene `deleteToken` muss in `localStorage` landen, **bevor**
  `onUploaded` aufgerufen wird — sonst könnte die Galerie-Seite das Foto
  schon anzeigen, ohne dass der eigene Löschen-Button sichtbar ist.
- Der Admin-Modus-Schalter darf beim Umschalten nie den angezeigten
  Zustand der drei bestehenden Schreib-Sperren-Schalter verändern (gleiche
  Art von Isolations-Anforderung wie beim granularen Schreib-Sperre-Plan).
- Ein fehlgeschlagenes Löschen in der neuen Admin-Galerie-Lösch-Liste darf
  das Foto nicht aus der Liste entfernen, solange der Server es nicht
  bestätigt hat (gleiches Prinzip wie bei Gästebuch/Erinnerungen).

---

## Task 1: Client-seitige Thumbnail-Erzeugung

**Files:**
- Create: `src/lib/gallery-thumbnail.ts`
- Test: `src/lib/gallery-thumbnail.test.ts`

**Interfaces:**
- Produces: `createThumbnailBlob(file: File): Promise<Blob>`. Von Task 2
  konsumiert.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```ts
// src/lib/gallery-thumbnail.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThumbnailBlob } from './gallery-thumbnail'

function fakeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap
}

describe('createThumbnailBlob', () => {
  const mockToBlob = vi.fn()
  const mockDrawImage = vi.fn()
  const mockGetContext = vi.fn(() => ({ drawImage: mockDrawImage }))

  beforeEach(() => {
    mockToBlob.mockReset()
    mockDrawImage.mockReset()
    mockGetContext.mockReset().mockReturnValue({ drawImage: mockDrawImage })
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext: mockGetContext, toBlob: mockToBlob } as unknown as HTMLCanvasElement
      }
      return document.createElement(tag)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('downscales a large image in two steps and produces a JPEG thumbnail', async () => {
    const original = fakeBitmap(8000, 6000)
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockImplementation((_source: unknown, options?: { resizeWidth?: number; resizeHeight?: number }) => {
        if (!options) return Promise.resolve(original)
        return Promise.resolve(fakeBitmap(options.resizeWidth ?? 0, options.resizeHeight ?? 0))
      })
    )
    const fakeBlob = new Blob(['thumb'])
    mockToBlob.mockImplementation((cb: (blob: Blob) => void) => cb(fakeBlob))

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await createThumbnailBlob(file)

    expect(result).toBe(fakeBlob)
    expect(mockDrawImage).toHaveBeenCalled()
    expect(mockToBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8)
  })

  it('skips resizing when the image is already small enough', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap(400, 300)))
    const fakeBlob = new Blob(['thumb'])
    mockToBlob.mockImplementation((cb: (blob: Blob) => void) => cb(fakeBlob))

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await createThumbnailBlob(file)

    // Nur der ursprüngliche createImageBitmap-Aufruf (ohne Resize-Optionen) -
    // kein zusätzlicher Downscale-Schritt für ein bereits kleines Bild.
    expect(createImageBitmap).toHaveBeenCalledTimes(1)
  })

  it('rejects when the canvas cannot produce a blob', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap(400, 300)))
    mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => cb(null))

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(createThumbnailBlob(file)).rejects.toThrow('Thumbnail-Erstellung fehlgeschlagen.')
  })

  it('throws when the canvas context is unavailable', async () => {
    mockGetContext.mockReturnValueOnce(null)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap(400, 300)))

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(createThumbnailBlob(file)).rejects.toThrow('Canvas-Kontext nicht verfügbar.')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/gallery-thumbnail.test.ts`
Expected: FAIL — `Failed to resolve import "./gallery-thumbnail"`

- [ ] **Step 3: `gallery-thumbnail.ts` implementieren**

```ts
// src/lib/gallery-thumbnail.ts
const SAFE_INTERMEDIATE_MAX_DIMENSION = 4096
const THUMB_MAX_DIMENSION = 800
const THUMB_JPEG_QUALITY = 0.8

async function resizeBitmap(source: ImageBitmap, maxDimension: number): Promise<ImageBitmap> {
  if (source.width <= maxDimension && source.height <= maxDimension) {
    return source
  }
  const scale = maxDimension / Math.max(source.width, source.height)
  return createImageBitmap(source, {
    resizeWidth: Math.round(source.width * scale),
    resizeHeight: Math.round(source.height * scale),
    resizeQuality: 'high',
  })
}

export async function createThumbnailBlob(file: File): Promise<Blob> {
  const original = await createImageBitmap(file, { imageOrientation: 'from-image' })
  // Zweistufiges Downscaling gegen Mobile Safaris Canvas-Flächenlimit
  // (~16,7 Megapixel): zuerst auf eine sichere Zwischengröße, dann erst
  // auf die Ziel-Thumbnail-Größe.
  const intermediate = await resizeBitmap(original, SAFE_INTERMEDIATE_MAX_DIMENSION)
  if (intermediate !== original) original.close()
  const thumb = await resizeBitmap(intermediate, THUMB_MAX_DIMENSION)
  if (thumb !== intermediate) intermediate.close()

  const canvas = document.createElement('canvas')
  canvas.width = thumb.width
  canvas.height = thumb.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    thumb.close()
    throw new Error('Canvas-Kontext nicht verfügbar.')
  }
  ctx.drawImage(thumb, 0, 0)
  thumb.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Thumbnail-Erstellung fehlgeschlagen.'))),
      'image/jpeg',
      THUMB_JPEG_QUALITY
    )
  })
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/gallery-thumbnail.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/lib/gallery-thumbnail.ts src/lib/gallery-thumbnail.test.ts
git commit -m "Add client-side thumbnail generation for gallery uploads"
```

---

## Task 2: `GalleryUploadForm`-Komponente (Gast & Admin)

**Files:**
- Create: `src/components/gallery/GalleryUploadForm.tsx`
- Test: `src/components/gallery/GalleryUploadForm.test.tsx`

**Interfaces:**
- Consumes: `createThumbnailBlob` (Task 1), `galleryCategories`
  (bestehend), `saveDeleteToken` (bestehend, `gallery-delete-tokens.ts`),
  `GalleryPhotoView` (bestehend), `Button` (bestehend, `components/ui`).
- Produces: `<GalleryUploadForm isAdmin?: boolean onUploaded={(photo:
  GalleryPhotoView) => void} />`. Von Task 3 und 5 konsumiert.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```tsx
// src/components/gallery/GalleryUploadForm.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GalleryUploadForm from './GalleryUploadForm'
import { getDeleteToken } from '@/lib/gallery-delete-tokens'

vi.mock('@/lib/gallery-thumbnail', () => ({
  createThumbnailBlob: vi.fn().mockResolvedValue(new Blob(['thumb'])),
}))

function makeFile(name = 'photo.jpg', type = 'image/jpeg'): File {
  return new File(['x'.repeat(100)], name, { type })
}

describe('GalleryUploadForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('shows a password field for a guest, but not for an admin', () => {
    const { rerender } = render(<GalleryUploadForm onUploaded={vi.fn()} />)
    expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument()

    rerender(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
  })

  it('requires a name before submitting', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)

    await userEvent.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await userEvent.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(screen.getByText(/bitte gib deinen namen ein/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires a password for a guest upload', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<GalleryUploadForm onUploaded={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/dein name/i), 'Anna')
    await userEvent.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await userEvent.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(screen.getByText(/kennwort vom empfang/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uploads a file end to end for a guest, saves the delete token, and reports the new photo', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/uploads/request') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tickets: [
              {
                photoId: 'p1',
                thumbPutUrl: 'https://r2.example/thumb',
                originalPutUrl: 'https://r2.example/original',
                ticket: 'signed-ticket',
              },
            ],
          }),
        })
      }
      if (url === 'https://r2.example/thumb' || url === 'https://r2.example/original') {
        return Promise.resolve({ ok: true })
      }
      if (url === '/api/uploads/complete') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            photo: {
              id: 'p1',
              uploaderName: 'Anna',
              category: 'Kennenlernen',
              isOfficial: false,
              createdAt: '2026-10-12T10:00:00.000Z',
              thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
              originalUrl: 'https://fotos.example.de/p1/original.jpg',
            },
            deleteToken: 'guest-delete-token',
          }),
        })
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    // Prüft direkt im Callback, dass der Token schon in localStorage liegt,
    // WENN onUploaded aufgerufen wird - nicht erst danach. Eine Regression,
    // die die Reihenfolge vertauscht, würde hier fehlschlagen.
    const onUploaded = vi.fn((photo: { id: string }) => {
      expect(getDeleteToken(photo.id)).toBe('guest-delete-token')
    })

    render(<GalleryUploadForm onUploaded={onUploaded} />)
    await userEvent.type(screen.getByLabelText(/dein name/i), 'Anna')
    await userEvent.type(screen.getByLabelText(/kennwort/i), 'empfang-secret')
    await userEvent.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await userEvent.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' })))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/uploads/request',
      expect.objectContaining({
        body: JSON.stringify({
          password: 'empfang-secret',
          category: 'Kennenlernen',
          files: [{ filename: 'photo.jpg', size: 100, contentType: 'image/jpeg' }],
        }),
      })
    )
  })

  it('uploads without a password field when used as an admin', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/uploads/request') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tickets: [{ photoId: 'p1', thumbPutUrl: 'https://r2.example/thumb', originalPutUrl: 'https://r2.example/original', ticket: 'signed-ticket' }],
          }),
        })
      }
      if (url === '/api/uploads/complete') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            photo: {
              id: 'p1', uploaderName: 'Saruga', category: 'Kennenlernen', isOfficial: true,
              createdAt: '2026-10-12T10:00:00.000Z',
              thumbUrl: 'https://fotos.example.de/p1/thumb.jpg', originalUrl: 'https://fotos.example.de/p1/original.jpg',
            },
            deleteToken: 'admin-delete-token',
          }),
        })
      }
      return Promise.resolve({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(/dein name/i), 'Saruga')
    await userEvent.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await userEvent.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/uploads/request',
        expect.objectContaining({
          body: JSON.stringify({ category: 'Kennenlernen', files: [{ filename: 'photo.jpg', size: 100, contentType: 'image/jpeg' }] }),
        })
      )
    )
  })

  it('marks only the failing file as an error in a multi-file batch, not the others', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/uploads/request') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tickets: [
              { photoId: 'p1', thumbPutUrl: 'https://r2.example/thumb1', originalPutUrl: 'https://r2.example/original1', ticket: 'ticket-1' },
              { photoId: 'p2', thumbPutUrl: 'https://r2.example/thumb2', originalPutUrl: 'https://r2.example/original2', ticket: 'ticket-2' },
            ],
          }),
        })
      }
      if (url === '/api/uploads/complete') {
        const body = JSON.parse(options?.body as string) as { ticket: string }
        if (body.ticket === 'ticket-2') {
          return Promise.resolve({ ok: false, json: async () => ({ error: 'Fehler' }) })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            photo: {
              id: 'p1', uploaderName: 'Anna', category: 'Kennenlernen', isOfficial: false,
              createdAt: '2026-10-12T10:00:00.000Z',
              thumbUrl: 'https://fotos.example.de/p1/thumb.jpg', originalUrl: 'https://fotos.example.de/p1/original.jpg',
            },
            deleteToken: 'token-1',
          }),
        })
      }
      return Promise.resolve({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)
    const onUploaded = vi.fn()

    render(<GalleryUploadForm isAdmin onUploaded={onUploaded} />)
    await userEvent.type(screen.getByLabelText(/dein name/i), 'Anna')
    await userEvent.upload(screen.getByLabelText(/fotos ausw/i), [makeFile('a.jpg'), makeFile('b.jpg')])
    await userEvent.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1))
    expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
    expect(screen.getAllByText(/hochladen fehlgeschlagen/i)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/gallery/GalleryUploadForm.test.tsx`
Expected: FAIL — `Failed to resolve import "./GalleryUploadForm"`

- [ ] **Step 3: `GalleryUploadForm.tsx` implementieren**

```tsx
// src/components/gallery/GalleryUploadForm.tsx
'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Upload, CheckCircle2, XCircle, Loader2, User, KeyRound } from 'lucide-react'
import Button from '@/components/ui/Button'
import { galleryCategories } from '@/lib/gallery-categories'
import { createThumbnailBlob } from '@/lib/gallery-thumbnail'
import { saveDeleteToken } from '@/lib/gallery-delete-tokens'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'

interface GalleryUploadFormProps {
  isAdmin?: boolean
  onUploaded: (photo: GalleryPhotoView) => void
}

type FileStatus = 'pending' | 'uploading' | 'done' | 'error'

interface SelectedFile {
  file: File
  status: FileStatus
}

interface UploadTicket {
  photoId: string
  thumbPutUrl: string
  originalPutUrl: string
  ticket: string
}

export default function GalleryUploadForm({ isAdmin = false, onUploaded }: GalleryUploadFormProps) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [category, setCategory] = useState<string>(galleryCategories[0])
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setSelectedFiles(files.map((file) => ({ file, status: 'pending' as const })))
  }

  const updateFileStatus = (index: number, status: FileStatus) => {
    setSelectedFiles((prev) => prev.map((f, i) => (i === index ? { ...f, status } : f)))
  }

  const uploadOneFile = async (selected: SelectedFile, index: number, ticket: UploadTicket) => {
    updateFileStatus(index, 'uploading')
    try {
      const thumbBlob = await createThumbnailBlob(selected.file)
      await Promise.all([
        fetch(ticket.thumbPutUrl, { method: 'PUT', body: thumbBlob, headers: { 'Content-Type': 'image/jpeg' } }),
        fetch(ticket.originalPutUrl, { method: 'PUT', body: selected.file, headers: { 'Content-Type': selected.file.type } }),
      ])
      const completeResponse = await fetch('/api/uploads/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: ticket.ticket, uploaderName: name.trim() }),
      })
      if (!completeResponse.ok) {
        updateFileStatus(index, 'error')
        return
      }
      const { photo, deleteToken } = (await completeResponse.json()) as {
        photo: GalleryPhotoView
        deleteToken: string
      }
      // Token zuerst speichern, danach erst den Elternteil informieren -
      // sonst könnte die Galerie das Foto schon zeigen, bevor der eigene
      // Löschen-Button sichtbar werden kann.
      saveDeleteToken(photo.id, deleteToken)
      updateFileStatus(index, 'done')
      onUploaded(photo)
    } catch {
      updateFileStatus(index, 'error')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError('Bitte gib deinen Namen ein.')
      return
    }
    if (!isAdmin && !password) {
      setFormError('Bitte gib das Kennwort vom Empfang ein.')
      return
    }
    if (selectedFiles.length === 0) {
      setFormError('Bitte wähle mindestens ein Foto aus.')
      return
    }

    setSubmitting(true)
    try {
      const requestResponse = await fetch('/api/uploads/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isAdmin ? {} : { password }),
          category,
          files: selectedFiles.map(({ file }) => ({ filename: file.name, size: file.size, contentType: file.type })),
        }),
      })
      if (!requestResponse.ok) {
        const body = await requestResponse.json().catch(() => null)
        setFormError(body?.error ?? 'Hochladen fehlgeschlagen. Bitte versuch es erneut.')
        return
      }
      const { tickets } = (await requestResponse.json()) as { tickets: UploadTicket[] }
      await Promise.all(selectedFiles.map((selected, index) => uploadOneFile(selected, index, tickets[index])))
    } catch {
      setFormError('Hochladen fehlgeschlagen. Bitte versuch es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="gallery-upload-name" className="block text-sm font-medium text-gray-700 mb-1.5">
          <User size={14} className="inline mr-1" />
          Dein Name
        </label>
        <input
          id="gallery-upload-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wie heißt du?"
          maxLength={60}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
        />
      </div>

      {!isAdmin && (
        <div>
          <label htmlFor="gallery-upload-password" className="block text-sm font-medium text-gray-700 mb-1.5">
            <KeyRound size={14} className="inline mr-1" />
            Kennwort vom Empfang
          </label>
          <input
            id="gallery-upload-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kennwort"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
          />
        </div>
      )}

      <div>
        <label htmlFor="gallery-upload-category" className="block text-sm font-medium text-gray-700 mb-1.5">
          Kategorie
        </label>
        <select
          id="gallery-upload-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
        >
          {galleryCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="gallery-upload-files" className="block text-sm font-medium text-gray-700 mb-1.5">
          Fotos auswählen (mehrere möglich)
        </label>
        <input
          id="gallery-upload-files"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesChange}
          className="w-full text-sm"
        />
      </div>

      {selectedFiles.length > 0 && (
        <ul className="space-y-1">
          {selectedFiles.map(({ file, status }, index) => (
            <li key={index} className="flex items-center gap-2 text-xs text-gray-600">
              {status === 'uploading' && <Loader2 size={14} className="animate-spin text-gray-400" />}
              {status === 'done' && <CheckCircle2 size={14} className="text-green-600" />}
              {status === 'error' && <XCircle size={14} className="text-red-600" />}
              {status === 'pending' && <span className="w-3.5" />}
              {file.name}
              {status === 'error' && <span className="text-red-600">Hochladen fehlgeschlagen.</span>}
            </li>
          ))}
        </ul>
      )}

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        <Upload size={16} />
        {submitting ? 'Wird hochgeladen...' : 'Hochladen'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/gallery/GalleryUploadForm.test.tsx`
Expected: PASS (6/6)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/components/gallery/GalleryUploadForm.tsx src/components/gallery/GalleryUploadForm.test.tsx
git commit -m "Add the shared guest/admin gallery upload form"
```

---

## Task 3: Upload in die Galerie-Seite einbinden

**Files:**
- Modify: `src/app/gallery/page.tsx`
- Modify: `src/app/gallery/page.test.tsx`

**Interfaces:**
- Consumes: `GalleryUploadForm` (Task 2).
- Produces: nichts Neues für andere Tasks — Endpunkt des Gast-Uploads.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```tsx
// src/app/gallery/page.test.tsx - neuer Test, ergänzt in der
// describe('GalleryPage', ...)-Gruppe (Rest der Datei unverändert):
it('shows the upload form when the floating button is clicked, and hides it again after a successful upload', async () => {
  mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [] } }])
  render(<GalleryPage />)
  await waitFor(() => expect(screen.getByRole('button', { name: /fotos hochladen/i })).toBeInTheDocument())

  await userEvent.click(screen.getByRole('button', { name: /fotos hochladen/i }))
  expect(screen.getByLabelText(/dein name/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/gallery/page.test.tsx`
Expected: FAIL — es gibt noch keinen Button „Fotos hochladen"

- [ ] **Step 3: `page.tsx` anpassen**

```tsx
// src/app/gallery/page.tsx - Imports und das 'unlocked'-Rendering
// ändern sich, Rest der Datei (Kennwort-Gate, Fehler-Status usw.)
// unverändert:

// Import ergänzen:
import { Camera } from 'lucide-react'
import GalleryUploadForm from '@/components/gallery/GalleryUploadForm'

// Neuer State (bei den anderen useState-Aufrufen ergänzen):
const [showUploadForm, setShowUploadForm] = useState(false)

// Neuer Handler:
const handleUploaded = (photo: GalleryPhotoView) => {
  setData((prev) => (prev.status === 'unlocked' ? { status: 'unlocked', photos: [photo, ...prev.photos] } : prev))
  setShowUploadForm(false)
}

// Den bisherigen Block
//   {data.status === 'unlocked' && <GalleryGrid photos={data.photos} onPhotoDeleted={handlePhotoDeleted} />}
// ersetzen durch:
{data.status === 'unlocked' && (
  <>
    <button
      type="button"
      onClick={() => setShowUploadForm((v) => !v)}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-gold text-dark-blue font-medium px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-shadow"
    >
      <Camera size={18} />
      Fotos hochladen
    </button>

    {showUploadForm && (
      <Card padding="lg" className="max-w-xl mx-auto mb-10">
        <GalleryUploadForm onUploaded={handleUploaded} />
      </Card>
    )}

    <GalleryGrid photos={data.photos} onPhotoDeleted={handlePhotoDeleted} />
  </>
)}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/gallery/page.test.tsx`
Expected: PASS (8/8)

- [ ] **Step 5: Gesamte Toolchain inklusive Build prüfen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün

- [ ] **Step 6: Commit**

```bash
git add src/app/gallery/page.tsx src/app/gallery/page.test.tsx
git commit -m "Wire the upload form into the gallery page"
```

---

## Task 4: Admin-Modus-Schalter (Öffentlich/Kennwort)

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx`
- Modify: `src/components/admin/AdminDashboard.test.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/admin/gallery-mode` (bestehend).
- Produces: `AdminDashboard`s Props bekommen `initialGalleryMode:
  'public' | 'password'`. Von Task 5 (selbe Datei, selbe Komponente)
  weiterverwendet.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```tsx
// src/components/admin/AdminDashboard.test.tsx - ergänzen (Rest der
// Datei unverändert, nur initialGalleryMode zu jedem render ergänzen):
// render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
// (für ALLE bestehenden render(...)-Aufrufe in dieser Datei)

// Neue Tests, ergänzt am Ende der describe('AdminDashboard', ...)-Gruppe.
// Wichtig: Task 4 fügt noch KEINEN dritten Fetch-Aufruf hinzu - die
// Galerie-Fotos werden erst in Task 5 geladen. Die Mount-Fetches bleiben
// hier bei genau zwei (guestbook, memories); der Galerie-Modus kommt aus
// der initialGalleryMode-PROP, nicht aus einem eigenen Fetch.
it('shows the current gallery mode and does not affect the three write-lock switches', async () => {
  const fetchMock = mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }])
  render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

  expect(screen.getByRole('button', { name: /^öffentlich$/i })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'false')
})

it('switching the gallery mode does not change the write-lock switches', async () => {
  const fetchMock = mockFetchSequence([
    { body: { entries: [] } },
    { body: { entries: [] } },
    { body: { mode: 'password' } },
  ])
  render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

  await userEvent.click(screen.getByRole('button', { name: /^kennwort$/i }))

  await waitFor(() => expect(screen.getByRole('button', { name: /^kennwort$/i })).toHaveAttribute('aria-pressed', 'true'))
  expect(screen.getByRole('switch', { name: /gästebuch/i })).toHaveAttribute('aria-checked', 'false')
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/admin/gallery-mode',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ mode: 'password' }) })
  )
})
```

Außerdem müssen **alle sieben bestehenden** `render(<AdminDashboard
initialLocks={noLocks} />)`-Aufrufe in dieser Datei um die neue
Pflicht-Prop ergänzt werden: `render(<AdminDashboard initialLocks={noLocks}
initialGalleryMode="public" />)`. Ohne diese Ergänzung schlagen die
bestehenden Tests nach Step 3 fehl, weil `AdminDashboard` dann einen
nicht vorhandenen Modus als `undefined` erhält, nicht weil der Test
selbst falsch ist.

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/admin/AdminDashboard.test.tsx`
Expected: FAIL — `initialGalleryMode` ist noch keine bekannte Prop, der
Modus-Schalter existiert noch nicht

- [ ] **Step 3: `AdminDashboard.tsx` erweitern**

```tsx
// src/components/admin/AdminDashboard.tsx - Ergänzungen (bestehender
// Code bleibt unverändert, nur die hier gezeigten Stellen kommen dazu):

// Import ergänzen:
import { Camera, LogOut, ShieldAlert, Trash2 } from 'lucide-react'

// Neuer Typ und erweiterte Props:
type GalleryMode = 'public' | 'password'

interface AdminDashboardProps {
  initialLocks: Locks
  initialGalleryMode: GalleryMode
}

// Im Komponentenkörper, bei den bestehenden useState-Aufrufen ergänzen:
export default function AdminDashboard({ initialLocks, initialGalleryMode }: AdminDashboardProps) {
  // ... bestehende State-Deklarationen bleiben ...
  const [galleryMode, setGalleryMode] = useState<GalleryMode>(initialGalleryMode)
  const [galleryModeError, setGalleryModeError] = useState<string | null>(null)
  const [changingGalleryMode, setChangingGalleryMode] = useState(false)

  // Neue Funktion, neben toggleLock ergänzen:
  const changeGalleryMode = async (mode: GalleryMode) => {
    if (mode === galleryMode) return
    setGalleryModeError(null)
    setChangingGalleryMode(true)
    try {
      const response = await fetch('/api/admin/gallery-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      if (!response.ok) {
        setGalleryModeError('Umschalten fehlgeschlagen. Bitte versuch es erneut.')
        return
      }
      const data = (await response.json()) as { mode: GalleryMode }
      setGalleryMode(data.mode)
    } catch {
      setGalleryModeError('Umschalten fehlgeschlagen. Bitte versuch es erneut.')
    } finally {
      setChangingGalleryMode(false)
    }
  }

  // ... bestehender toggleLock/handleLogout bleibt ...
}
```

JSX-Ergänzung: direkt **nach** dem `{lockError && (...)}`-Block, aber
**innerhalb** der schließenden `</Card>` der Schreib-Sperren-Karte:

```tsx
          <div className="flex items-center justify-between gap-4 pt-5 mt-5 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <Camera size={20} className="text-gray-400" />
              <div>
                <p className="font-semibold text-dark-blue text-sm">Galerie-Sichtbarkeit</p>
                <p className="text-xs text-gray-400">
                  {galleryMode === 'public' ? 'Öffentlich.' : 'Nur mit Kennwort.'}
                </p>
              </div>
            </div>
            <div className="flex rounded-full border border-gray-200 overflow-hidden" role="group" aria-label="Galerie-Sichtbarkeit">
              <button
                type="button"
                onClick={() => changeGalleryMode('public')}
                disabled={changingGalleryMode}
                aria-pressed={galleryMode === 'public'}
                className={cn(
                  'px-4 py-1.5 text-xs font-medium transition-colors',
                  galleryMode === 'public' ? 'bg-dark-blue text-white' : 'bg-white text-gray-600'
                )}
              >
                Öffentlich
              </button>
              <button
                type="button"
                onClick={() => changeGalleryMode('password')}
                disabled={changingGalleryMode}
                aria-pressed={galleryMode === 'password'}
                className={cn(
                  'px-4 py-1.5 text-xs font-medium transition-colors',
                  galleryMode === 'password' ? 'bg-dark-blue text-white' : 'bg-white text-gray-600'
                )}
              >
                Kennwort
              </button>
            </div>
          </div>
          {galleryModeError && (
            <p className="text-sm text-red-600 mt-4" role="alert">
              {galleryModeError}
            </p>
          )}
```

(Diese beiden Blöcke kommen direkt vor das schließende `</Card>` der
Schreib-Sperren-Karte, nach dem bestehenden `{lockError && (...)}`.)

- [ ] **Step 4: `admin/page.tsx` anpassen**

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

type GalleryMode = 'public' | 'password'

type AuthState =
  | { status: 'checking' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; locks: Locks; galleryMode: GalleryMode }

async function checkAuth(): Promise<AuthState> {
  try {
    const [lockResponse, galleryModeResponse] = await Promise.all([
      fetch('/api/admin/write-lock'),
      fetch('/api/admin/gallery-mode'),
    ])
    if (!lockResponse.ok || !galleryModeResponse.ok) {
      return { status: 'unauthenticated' }
    }
    const lockData = (await lockResponse.json()) as { locks: Locks }
    const galleryModeData = (await galleryModeResponse.json()) as { mode: GalleryMode }
    return { status: 'authenticated', locks: lockData.locks, galleryMode: galleryModeData.mode }
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
    return null
  }

  if (auth.status === 'unauthenticated') {
    return <AdminLoginForm onSuccess={() => checkAuth().then(setAuth)} />
  }

  return <AdminDashboard initialLocks={auth.locks} initialGalleryMode={auth.galleryMode} />
}
```

- [ ] **Step 5: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/admin/AdminDashboard.test.tsx`
Expected: PASS (8/8)

- [ ] **Step 6: `admin/page.test.tsx` anpassen**

```tsx
// src/app/admin/page.test.tsx (vollständige neue Fassung)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AdminPage from './page'

interface Locks {
  guestbook: boolean
  memories: boolean
  who_votes: boolean
}

type GalleryMode = 'public' | 'password'

vi.mock('@/components/admin/AdminLoginForm', () => ({
  default: ({ onSuccess }: { onSuccess: () => void }) => (
    <button onClick={onSuccess}>stub-login-success</button>
  ),
}))
vi.mock('@/components/admin/AdminDashboard', () => ({
  default: ({ initialLocks, initialGalleryMode }: { initialLocks: Locks; initialGalleryMode: GalleryMode }) => (
    <div data-testid="dashboard-stub">{JSON.stringify({ initialLocks, initialGalleryMode })}</div>
  ),
}))

function mockAuthFetch(locksOk: boolean, locks?: Locks, galleryModeOk = true, mode: GalleryMode = 'public') {
  return vi.fn().mockImplementation((url: string) => {
    if (url === '/api/admin/write-lock') {
      return Promise.resolve({ ok: locksOk, status: locksOk ? 200 : 401, json: async () => ({ locks }) })
    }
    if (url === '/api/admin/gallery-mode') {
      return Promise.resolve({ ok: galleryModeOk, status: galleryModeOk ? 200 : 401, json: async () => ({ mode }) })
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`))
  })
}

describe('AdminPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the login form when the admin check fails', async () => {
    vi.stubGlobal('fetch', mockAuthFetch(false))
    render(<AdminPage />)
    await waitFor(() => expect(screen.getByText('stub-login-success')).toBeInTheDocument())
  })

  it('shows the dashboard with the fetched lock status and gallery mode when already authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      mockAuthFetch(true, { guestbook: true, memories: false, who_votes: false }, true, 'password')
    )
    render(<AdminPage />)
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-stub')).toHaveTextContent(
        JSON.stringify({
          initialLocks: { guestbook: true, memories: false, who_votes: false },
          initialGalleryMode: 'password',
        })
      )
    )
  })

  it('switches from login to dashboard after a successful login', async () => {
    vi.stubGlobal('fetch', mockAuthFetch(false))
    render(<AdminPage />)
    const loginButton = await screen.findByText('stub-login-success')

    vi.stubGlobal('fetch', mockAuthFetch(true, { guestbook: false, memories: false, who_votes: false }))
    loginButton.click()

    await waitFor(() => expect(screen.getByTestId('dashboard-stub')).toBeInTheDocument())
  })
})
```

- [ ] **Step 7: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/admin/page.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 8: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 9: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/page.test.tsx \
  src/components/admin/AdminDashboard.tsx src/components/admin/AdminDashboard.test.tsx
git commit -m "Add the admin gallery-mode switch"
```

---

## Task 5: Admin-Galerie-Upload & Lösch-Liste

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`
- Modify: `src/components/admin/AdminDashboard.test.tsx`

**Interfaces:**
- Consumes: `GalleryUploadForm` (Task 2), `GET /api/gallery`,
  `DELETE /api/gallery/[id]` (bestehend).
- Produces: nichts Neues — letzter Baustein dieses Plans.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```tsx
// src/components/admin/AdminDashboard.test.tsx - ergänzen. Die
// bestehenden mockFetchSequence-Aufrufe mit 3 Einträgen (guestbook,
// memories, gallery-mode-Nebenwirkung aus Task 4) brauchen jetzt einen
// VIERTEN Eintrag für GET /api/gallery - in JEDEM bestehenden Test
// ergänzen, der mockFetchSequence mit den ersten beiden Einträgen
// (entries: []) nutzt, z.B.:
//   mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, { body: { photos: [] } }])
// wird zu:
//   mockFetchSequence([{ body: { entries: [] } }, { body: { entries: [] } }, { body: { photos: [] } }])
// (bereits in Task 4 ergänzt - hier kommt nur noch ein eigener Test dazu)

it('shows gallery photos and deletes one only after the server confirms', async () => {
  const fetchMock = mockFetchSequence([
    { body: { entries: [] } },
    { body: { entries: [] } },
    {
      body: {
        photos: [
          {
            id: 'p1', uploaderName: 'Anna', category: 'Hochzeit', isOfficial: false,
            createdAt: '2026-10-12T10:00:00.000Z',
            thumbUrl: 'https://fotos.example.de/p1/thumb.jpg', originalUrl: 'https://fotos.example.de/p1/original.jpg',
          },
        ],
      },
    },
    { status: 200, body: { success: true } },
  ])
  render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
  await waitFor(() => expect(screen.getByRole('img', { name: /foto von anna/i })).toBeInTheDocument())

  await userEvent.click(screen.getByRole('button', { name: /löschen.*anna/i }))

  await waitFor(() => expect(screen.queryByRole('img', { name: /foto von anna/i })).not.toBeInTheDocument())
  expect(fetchMock).toHaveBeenCalledWith('/api/gallery/p1', expect.objectContaining({ method: 'DELETE' }))
})

it('keeps the gallery photo visible if the server delete fails', async () => {
  mockFetchSequence([
    { body: { entries: [] } },
    { body: { entries: [] } },
    {
      body: {
        photos: [
          {
            id: 'p1', uploaderName: 'Anna', category: 'Hochzeit', isOfficial: false,
            createdAt: '2026-10-12T10:00:00.000Z',
            thumbUrl: 'https://fotos.example.de/p1/thumb.jpg', originalUrl: 'https://fotos.example.de/p1/original.jpg',
          },
        ],
      },
    },
    { status: 500, body: { error: 'Serverfehler' } },
  ])
  render(<AdminDashboard initialLocks={noLocks} initialGalleryMode="public" />)
  await waitFor(() => expect(screen.getByRole('img', { name: /foto von anna/i })).toBeInTheDocument())

  await userEvent.click(screen.getByRole('button', { name: /löschen.*anna/i }))

  await waitFor(() => expect(screen.getByText(/löschen fehlgeschlagen/i)).toBeInTheDocument())
  expect(screen.getByRole('img', { name: /foto von anna/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/admin/AdminDashboard.test.tsx`
Expected: FAIL — es gibt noch keine Galerie-Sektion im Dashboard

- [ ] **Step 3: `AdminDashboard.tsx` erweitern**

```tsx
// src/components/admin/AdminDashboard.tsx - weitere Ergänzungen:

// Import ergänzen:
import GalleryUploadForm from '@/components/gallery/GalleryUploadForm'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'

// Neuer State:
const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhotoView[]>([])

// Im bestehenden useEffect (zusammen mit den Fetches für guestbook/
// memories) ergänzen:
useEffect(() => {
  // ... bestehende guestbook/memories-Fetches bleiben ...

  fetch('/api/gallery')
    .then((res) => (res.ok ? res.json() : { photos: [] }))
    .then((data: { photos: GalleryPhotoView[] | null }) => setGalleryPhotos(data.photos ?? []))
    .catch(() => {})
}, [])

// Neue Funktion, neben deleteMemoryEntry ergänzen:
const deleteGalleryPhoto = async (id: string) => {
  setDeleteError(null)
  try {
    const response = await fetch(`/api/gallery/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
      return
    }
    setGalleryPhotos((prev) => prev.filter((photo) => photo.id !== id))
  } catch {
    setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
  }
}
```

JSX-Ergänzung: neuer Abschnitt in `<div className="space-y-8">`, nach dem
bestehenden Erinnerungen-Block:

```tsx
          <div>
            <h3 className="font-serif text-lg font-semibold text-dark-blue mb-3">
              Galerie ({galleryPhotos.length})
            </h3>
            <div className="mb-4">
              <GalleryUploadForm
                isAdmin
                onUploaded={(photo) => setGalleryPhotos((prev) => [photo, ...prev])}
              />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {galleryPhotos.map((photo) => (
                <div key={photo.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbUrl}
                    alt={`Foto von ${photo.uploaderName}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => deleteGalleryPhoto(photo.id)}
                    aria-label={`Löschen: Foto von ${photo.uploaderName}`}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
```

(Lösch-Button ist absichtlich **immer** sichtbar, nicht nur bei Hover -
gleiche Lehre wie beim Gast-Galerie-Review: Hover existiert auf
Touch-Geräten nicht.)

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/admin/AdminDashboard.test.tsx`
Expected: PASS (10/10)

- [ ] **Step 5: Gesamte Toolchain inklusive Build prüfen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminDashboard.tsx src/components/admin/AdminDashboard.test.tsx
git commit -m "Add admin gallery upload and thumbnail delete-list"
```

---

## Abschluss

Nach Task 5 ist die Galerie vollständig: Gäste können Fotos mit Kategorie
hochladen (client-seitige Thumbnail-Erzeugung, Fortschritt pro Datei),
Admin kann denselben Weg ohne Kennwort für offizielle Fotos nutzen, die
Galerie-Sichtbarkeit umschalten und alle Fotos über eine Lösch-Liste im
Dashboard verwalten. Damit ist die im Master-Spec vorgesehene
Galerie-Funktion (Backend + Ansicht + Upload + Admin) komplett.
