'use client'

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Upload, CheckCircle2, XCircle, Loader2, User, KeyRound, ImageIcon, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { defaultGalleryCategory, galleryCategories } from '@/lib/gallery-categories'
import { createPlaceholderThumbnailBlob, createThumbnailBlob } from '@/lib/gallery-thumbnail'
import { saveDeleteToken } from '@/lib/gallery-delete-tokens'
import {
  IMAGE_CONTENT_TYPE_EXTENSIONS,
  MAX_ORIGINAL_BYTES,
  resolveImageContentType,
} from '@/lib/gallery-upload-limits'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'

interface GalleryUploadFormProps {
  isAdmin?: boolean
  onUploaded: (photo: GalleryPhotoView) => void
}

// Ein Ticket gilt 15 Minuten, und alle gleichzeitigen Uploads teilen sich die
// Bandbreite. Deshalb werden Tickets nur für eine kleine Gruppe auf einmal
// angefragt und die Gruppe wird fertig hochgeladen, bevor die nächste startet.
// Das begrenzt auch die gleichzeitig dekodierten Vollbilder (Speicher auf
// dem iPhone).
const FILES_PER_GROUP = 3

const GENERIC_UPLOAD_ERROR = 'Hochladen fehlgeschlagen.'

// Ein einzelnes Foto darf höchstens so lange brauchen - danach gilt es als
// hängengeblieben (Funkloch, Tab im Hintergrund) und lässt sich erneut starten.
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000
const TIMEOUT_MESSAGE = 'Zeitüberschreitung – bitte erneut versuchen.'
const CANCELLED_MESSAGE = 'Abgebrochen.'

type FileStatus = 'pending' | 'uploading' | 'done' | 'error'

interface SelectedFile {
  file: File
  contentType: string
  status: FileStatus
  /** Nicht hochladbar (Typ/Größe): wird übersprungen und nie wiederholt. */
  invalid: boolean
  message?: string
  /** Vorschau: URL des erzeugten Thumbnails, null = nur Platzhalter, undefined = noch keine. */
  previewUrl?: string | null
}

interface UploadTicket {
  photoId: string
  thumbPutUrl: string
  originalPutUrl: string
  ticket: string
}

type UploadResult = { photo: GalleryPhotoView; deleteToken: string } | { error: string } | { cancelled: true }

function toSelectedFile(file: File): SelectedFile {
  const contentType = resolveImageContentType(file)
  if (!IMAGE_CONTENT_TYPE_EXTENSIONS.has(contentType)) {
    return { file, contentType, status: 'error', invalid: true, message: 'Dateityp nicht unterstützt.' }
  }
  if (file.size === 0) {
    return { file, contentType, status: 'error', invalid: true, message: 'Datei ist leer.' }
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    return { file, contentType, status: 'error', invalid: true, message: 'Zu groß (max. 20 MB).' }
  }
  return { file, contentType, status: 'pending', invalid: false }
}

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

function pluralPhotos(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export default function GalleryUploadForm({ isAdmin = false, onUploaded }: GalleryUploadFormProps) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [category, setCategory] = useState<string>(defaultGalleryCategory)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const previewUrlsRef = useRef<string[]>([])

  const releasePreviews = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current = []
  }

  // Beim Entfernen des Formulars die Objekt-URLs der Vorschauen freigeben.
  useEffect(() => releasePreviews, [])

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormError(null)
    releasePreviews()
    setSelectedFiles(Array.from(e.target.files ?? []).map(toSelectedFile))
  }

  const updateFile = (index: number, changes: Partial<SelectedFile>) => {
    setSelectedFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...changes } : f)))
  }

  const requestTickets = async (
    files: SelectedFile[],
    signal: AbortSignal
  ): Promise<{ tickets: UploadTicket[] } | { error: string }> => {
    const response = await fetch('/api/uploads/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        ...(isAdmin ? {} : { password }),
        category,
        files: files.map(({ file, contentType }) => ({ filename: file.name, size: file.size, contentType })),
      }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { error: body?.error ?? 'Hochladen fehlgeschlagen. Bitte versuch es erneut.' }
    }
    return (await response.json()) as { tickets: UploadTicket[] }
  }

  const uploadOneFile = async (index: number, selected: SelectedFile, ticket: UploadTicket, signal: AbortSignal) => {
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
      // Zurück auf "wartet": lässt sich über "Hochladen" erneut starten.
      updateFile(index, { status: 'pending', message: CANCELLED_MESSAGE })
      return
    }
    if ('error' in result) {
      updateFile(index, { status: 'error', message: result.error })
      return
    }
    // Token zuerst speichern, danach erst den Elternteil informieren -
    // sonst könnte die Galerie das Foto schon zeigen, bevor der eigene
    // Löschen-Button sichtbar werden kann.
    saveDeleteToken(result.photo.id, result.deleteToken)
    updateFile(index, { status: 'done', message: undefined })
    onUploaded(result.photo)
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

    // Bei einem erneuten Versuch nur das, was noch nicht hochgeladen ist -
    // sonst entstünden Duplikate der bereits fertigen Fotos.
    const queue = selectedFiles
      .map((selected, index) => ({ selected, index }))
      .filter(({ selected }) => !selected.invalid && selected.status !== 'done')
    if (queue.length === 0) {
      setFormError(
        selectedFiles.some((f) => f.status === 'done')
          ? 'Diese Fotos sind schon hochgeladen. Wähle weitere Fotos aus.'
          : 'Keine der ausgewählten Dateien kann hochgeladen werden.'
      )
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setSubmitting(true)
    try {
      for (let start = 0; start < queue.length; start += FILES_PER_GROUP) {
        if (controller.signal.aborted) break
        const group = queue.slice(start, start + FILES_PER_GROUP)
        const ticketsResult = await requestTickets(
          group.map(({ selected }) => selected),
          controller.signal
        )
        if ('error' in ticketsResult) {
          setFormError(ticketsResult.error)
          break
        }
        await Promise.all(
          group.map(({ selected, index }, i) =>
            uploadOneFile(index, selected, ticketsResult.tickets[i], controller.signal)
          )
        )
      }
    } catch {
      // Ein Abbruch ist keine Fehlermeldung wert.
      if (!controller.signal.aborted) {
        setFormError('Hochladen fehlgeschlagen. Bitte versuch es erneut.')
      }
    } finally {
      abortRef.current = null
      setSubmitting(false)
    }
  }

  const cancelUpload = () => abortRef.current?.abort()

  const doneCount = selectedFiles.filter((f) => f.status === 'done').length
  const failedCount = selectedFiles.filter((f) => f.status === 'error' && !f.invalid).length
  const cancelledCount = selectedFiles.filter((f) => f.status === 'pending' && f.message === CANCELLED_MESSAGE).length
  const summaryParts: string[] = []
  if (doneCount > 0) {
    summaryParts.push(`${pluralPhotos(doneCount, 'Foto', 'Fotos')} hochgeladen – danke!`)
  }
  if (failedCount > 0) {
    summaryParts.push(
      `${pluralPhotos(failedCount, 'Foto konnte', 'Fotos konnten')} nicht hochgeladen werden. Tippe erneut auf „Hochladen“.`
    )
  }
  if (cancelledCount > 0) {
    summaryParts.push(
      `${pluralPhotos(cancelledCount, 'Foto', 'Fotos')} abgebrochen – tippe auf „Hochladen“, um sie erneut zu senden.`
    )
  }
  const statusText = submitting
    ? 'Bitte lass diese Seite geöffnet, bis alle Fotos hochgeladen sind.'
    : summaryParts.join(' ')

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
          disabled={submitting}
          onChange={handleFilesChange}
          className="w-full text-sm"
        />
      </div>

      {selectedFiles.length > 0 && (
        <ul className="space-y-1">
          {selectedFiles.map(({ file, status, message, previewUrl }, index) => (
            <li key={index} className="flex flex-wrap items-center gap-x-2 text-xs text-gray-600">
              {status === 'uploading' && <Loader2 size={14} className="animate-spin text-gray-400" />}
              {status === 'done' && <CheckCircle2 size={14} className="text-green-600" />}
              {status === 'error' && <XCircle size={14} className="text-red-600" />}
              {status === 'pending' && <span className="w-3.5" />}
              {previewUrl !== undefined && (
                <span className="w-10 h-10 rounded-lg overflow-hidden bg-champagne/50 flex items-center justify-center flex-shrink-0">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span data-testid="upload-preview-fallback" className="text-gray-400">
                      <ImageIcon size={16} />
                    </span>
                  )}
                </span>
              )}
              <span className="break-all">{file.name}</span>
              {status === 'pending' && message && <span className="text-gray-500">{message}</span>}
              {status === 'error' && <span className="text-red-600">{message ?? GENERIC_UPLOAD_ERROR}</span>}
            </li>
          ))}
        </ul>
      )}

      {statusText && (
        <p role="status" className="text-sm text-gray-700">
          {statusText}
        </p>
      )}

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        <Upload size={16} />
        {submitting ? 'Wird hochgeladen...' : 'Hochladen'}
      </Button>

      {submitting && (
        <Button type="button" variant="secondary" size="lg" onClick={cancelUpload} className="w-full">
          <X size={16} />
          Abbrechen
        </Button>
      )}
    </form>
  )
}
