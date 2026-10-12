'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Upload, CheckCircle2, XCircle, Loader2, User, KeyRound } from 'lucide-react'
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

type FileStatus = 'pending' | 'uploading' | 'done' | 'error'

interface SelectedFile {
  file: File
  contentType: string
  status: FileStatus
  /** Nicht hochladbar (Typ/Größe): wird übersprungen und nie wiederholt. */
  invalid: boolean
  message?: string
}

interface UploadTicket {
  photoId: string
  thumbPutUrl: string
  originalPutUrl: string
  ticket: string
}

type UploadResult = { photo: GalleryPhotoView; deleteToken: string } | { error: string }

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

async function createThumbnailOrPlaceholder(file: File): Promise<Blob> {
  try {
    return await createThumbnailBlob(file)
  } catch {
    // Nicht dekodierbar (z. B. HEIC außerhalb von Safari): das Original
    // wird trotzdem hochgeladen, die Galerie zeigt eine neutrale Fläche.
    return createPlaceholderThumbnailBlob()
  }
}

async function uploadAndRegister(selected: SelectedFile, ticket: UploadTicket, uploaderName: string): Promise<UploadResult> {
  try {
    const thumbBlob = await createThumbnailOrPlaceholder(selected.file)
    const [thumbResponse, originalResponse] = await Promise.all([
      fetch(ticket.thumbPutUrl, { method: 'PUT', body: thumbBlob, headers: { 'Content-Type': 'image/jpeg' } }),
      fetch(ticket.originalPutUrl, { method: 'PUT', body: selected.file, headers: { 'Content-Type': selected.contentType } }),
    ])
    if (!thumbResponse.ok || !originalResponse.ok) {
      return { error: 'Übertragung fehlgeschlagen.' }
    }
    const completeResponse = await fetch('/api/uploads/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: ticket.ticket, uploaderName }),
    })
    if (!completeResponse.ok) {
      const body = await completeResponse.json().catch(() => null)
      return { error: body?.error ?? GENERIC_UPLOAD_ERROR }
    }
    return (await completeResponse.json()) as { photo: GalleryPhotoView; deleteToken: string }
  } catch {
    return { error: GENERIC_UPLOAD_ERROR }
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

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormError(null)
    setSelectedFiles(Array.from(e.target.files ?? []).map(toSelectedFile))
  }

  const updateFile = (index: number, changes: Partial<SelectedFile>) => {
    setSelectedFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...changes } : f)))
  }

  const requestTickets = async (files: SelectedFile[]): Promise<{ tickets: UploadTicket[] } | { error: string }> => {
    const response = await fetch('/api/uploads/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  const uploadOneFile = async (index: number, selected: SelectedFile, ticket: UploadTicket) => {
    updateFile(index, { status: 'uploading', message: undefined })
    const result = await uploadAndRegister(selected, ticket, name.trim())
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

    setSubmitting(true)
    try {
      for (let start = 0; start < queue.length; start += FILES_PER_GROUP) {
        const group = queue.slice(start, start + FILES_PER_GROUP)
        const ticketsResult = await requestTickets(group.map(({ selected }) => selected))
        if ('error' in ticketsResult) {
          setFormError(ticketsResult.error)
          break
        }
        await Promise.all(
          group.map(({ selected, index }, i) => uploadOneFile(index, selected, ticketsResult.tickets[i]))
        )
      }
    } catch {
      setFormError('Hochladen fehlgeschlagen. Bitte versuch es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  const doneCount = selectedFiles.filter((f) => f.status === 'done').length
  const failedCount = selectedFiles.filter((f) => f.status === 'error' && !f.invalid).length
  const summaryParts: string[] = []
  if (doneCount > 0) {
    summaryParts.push(`${pluralPhotos(doneCount, 'Foto', 'Fotos')} hochgeladen – danke!`)
  }
  if (failedCount > 0) {
    summaryParts.push(
      `${pluralPhotos(failedCount, 'Foto konnte', 'Fotos konnten')} nicht hochgeladen werden. Tippe erneut auf „Hochladen“.`
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
          {selectedFiles.map(({ file, status, message }, index) => (
            <li key={index} className="flex flex-wrap items-center gap-x-2 text-xs text-gray-600">
              {status === 'uploading' && <Loader2 size={14} className="animate-spin text-gray-400" />}
              {status === 'done' && <CheckCircle2 size={14} className="text-green-600" />}
              {status === 'error' && <XCircle size={14} className="text-red-600" />}
              {status === 'pending' && <span className="w-3.5" />}
              <span className="break-all">{file.name}</span>
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
    </form>
  )
}
