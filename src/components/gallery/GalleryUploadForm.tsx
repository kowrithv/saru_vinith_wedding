'use client'

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Upload, CheckCircle2, XCircle, Loader2, User, ImageIcon, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import GuestPasswordField from '@/components/ui/GuestPasswordField'
import { defaultGalleryCategory, uploadCategoriesFor } from '@/lib/gallery-categories'
import { createPreviewImage, type PreviewImage } from '@/lib/gallery-preview'
import { saveDeleteToken } from '@/lib/gallery-delete-tokens'
import {
  IMAGE_CONTENT_TYPE_EXTENSIONS,
  MAX_ORIGINAL_BYTES,
  resolveImageContentType,
  UPLOADS_PAUSED_MESSAGE,
} from '@/lib/gallery-upload-limits'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'
import { textFieldClassName } from '@/lib/form-styles'
import { useGuestName } from '@/lib/use-guest-name'

interface GalleryUploadFormProps {
  isAdmin?: boolean
  /** Dieser Browser ist schon entsperrt (QR-Link/Kennwort): kein Kennwortfeld. */
  hasAccess?: boolean
  /** Der Server hat ein getipptes Kennwort angenommen und die Sitzung gesetzt. */
  onAccessGranted?: () => void
  /** Die gemerkte Sitzung gilt nicht mehr (abgelaufen, Kennwort gewechselt). */
  onAccessLost?: () => void
  onUploaded: (photo: GalleryPhotoView) => void
}

// Ein Ticket gilt 15 Minuten, und alle gleichzeitigen Uploads teilen sich die
// Bandbreite. Deshalb werden Tickets nur für eine kleine Gruppe auf einmal
// angefragt und die Gruppe wird fertig hochgeladen, bevor die nächste startet.
// Das begrenzt auch die gleichzeitig dekodierten Vollbilder (Speicher auf
// dem iPhone).
const FILES_PER_GROUP = 3

const GENERIC_UPLOAD_ERROR = 'Hochladen fehlgeschlagen.'

// Zeitlimit für die Übertragung einer Gruppe: wer keine Verbindung hat, soll
// nicht ewig warten - eine langsame Leitung (3 Fotos teilen sich den Uplink im
// WLAN der Feier) darf aber nicht scheitern, nur weil sie langsam ist. Das
// Limit wächst deshalb mit den Bytes der Gruppe (Untergrenze 20 KB/s), bleibt
// über 5 Minuten und endet spätestens mit dem Ticket (15 Minuten).
const MIN_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000
const MAX_UPLOAD_TIMEOUT_MS = 15 * 60 * 1000
const MIN_UPLOAD_BYTES_PER_SECOND = 20 * 1024
// Das Registrieren ist eine kurze Server-Anfrage nach der Übertragung.
const COMPLETE_TIMEOUT_MS = 60 * 1000
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

interface UploadControl {
  /** Wird beim Klick auf "Abbrechen" ausgelöst. */
  signal: AbortSignal
  /** Zeitlimit für die Übertragung (Thumbnail und Original). */
  timeoutMs: number
  onPreview: (blob: Blob, isPlaceholder: boolean) => void
}

async function uploadAndRegister(
  selected: SelectedFile,
  ticket: UploadTicket,
  preview: PreviewImage,
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
  }, control.timeoutMs)
  const { signal } = fileController
  let transferred = false
  let completeTimedOut = false

  try {
    // Die Vorschau gibt es schon (ihre Größe steht im Ticket).
    control.onPreview(preview.blob, preview.isPlaceholder)
    const [thumbResponse, originalResponse] = await Promise.all([
      fetch(ticket.thumbPutUrl, {
        method: 'PUT',
        body: preview.blob,
        headers: { 'Content-Type': 'image/jpeg' },
        signal,
      }),
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

    // Ab hier liegen die Bytes im Speicher. Das Registrieren darf weder durch
    // "Abbrechen" noch durch das Übertragungs-Limit unterbrochen werden: der
    // Server schließt die Anfrage ohnehin ab, und ein erneuter Versuch würde
    // das Foto ein zweites Mal anlegen (ohne Löschen-Token für die erste Kopie).
    transferred = true
    clearTimeout(timer)
    control.signal.removeEventListener('abort', onCancel)
    const completeController = new AbortController()
    const completeTimer = setTimeout(() => {
      completeTimedOut = true
      completeController.abort()
    }, COMPLETE_TIMEOUT_MS)
    try {
      const completeResponse = await fetch('/api/uploads/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: ticket.ticket, uploaderName }),
        signal: completeController.signal,
      })
      if (!completeResponse.ok) {
        const body = await completeResponse.json().catch(() => null)
        return { error: body?.error ?? GENERIC_UPLOAD_ERROR }
      }
      return (await completeResponse.json()) as { photo: GalleryPhotoView; deleteToken: string }
    } finally {
      clearTimeout(completeTimer)
    }
  } catch {
    if (transferred) return { error: completeTimedOut ? TIMEOUT_MESSAGE : GENERIC_UPLOAD_ERROR }
    if (timedOut) return { error: TIMEOUT_MESSAGE }
    if (control.signal.aborted) return { cancelled: true }
    return { error: GENERIC_UPLOAD_ERROR }
  } finally {
    clearTimeout(timer)
    control.signal.removeEventListener('abort', onCancel)
    // Scheitert eine der beiden Übertragungen, endet Promise.all sofort - die
    // andere liefe sonst weiter (Bandbreite, Speicher) für ein Foto, das nie
    // registriert wird.
    if (!transferred) fileController.abort()
  }
}

function uploadTimeoutMs(groupBytes: number): number {
  const needed = (groupBytes / MIN_UPLOAD_BYTES_PER_SECOND) * 1000
  return Math.min(MAX_UPLOAD_TIMEOUT_MS, Math.max(MIN_UPLOAD_TIMEOUT_MS, needed))
}

function pluralPhotos(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export default function GalleryUploadForm({
  isAdmin = false,
  hasAccess = false,
  onAccessGranted,
  onAccessLost,
  onUploaded,
}: GalleryUploadFormProps) {
  // Der Admin hat nie ein Kennwortfeld; Gäste nur, solange der Browser nicht
  // entsperrt ist.
  const needsPassword = !isAdmin && !hasAccess
  // Der Name wird in allen Formularen nur einmal getippt.
  const { name, setName, remember } = useGuestName()
  const [password, setPassword] = useState('')
  const [category, setCategory] = useState<string>(defaultGalleryCategory)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const previewUrlsRef = useRef<string[]>([])
  const formRef = useRef<HTMLFormElement>(null)
  // "Abbrechen" verschwindet, sobald der Upload beendet ist: der Fokus würde
  // dabei auf <body> fallen (Tastatur, VoiceOver). Er geht stattdessen auf
  // "Hochladen", den naheliegenden nächsten Schritt.
  const restoreFocusRef = useRef(false)

  const releasePreviews = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current = []
  }

  // Beim Entfernen des Formulars die Objekt-URLs der Vorschauen freigeben.
  useEffect(() => releasePreviews, [])

  useEffect(() => {
    if (submitting || !restoreFocusRef.current) return
    restoreFocusRef.current = false
    // Das Registrieren eines schon übertragenen Fotos kann nach "Abbrechen"
    // noch bis zu einer Minute dauern: hat der Gast inzwischen woanders
    // hingetippt, darf der Fokus nicht (samt Tastatur) wegspringen.
    const active = document.activeElement
    if (active && active !== document.body) return
    formRef.current?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus()
  }, [submitting])

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormError(null)
    setCancelled(false)
    releasePreviews()
    setSelectedFiles(Array.from(e.target.files ?? []).map(toSelectedFile))
  }

  const updateFile = (index: number, changes: Partial<SelectedFile>) => {
    setSelectedFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...changes } : f)))
  }

  const requestTickets = async (
    files: SelectedFile[],
    previews: PreviewImage[],
    signal: AbortSignal
  ): Promise<{ tickets: UploadTicket[] } | { error: string }> => {
    const response = await fetch('/api/uploads/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        ...(needsPassword ? { password } : {}),
        category,
        files: files.map(({ file, contentType }, i) => ({
          filename: file.name,
          size: file.size,
          contentType,
          thumbSize: previews[i].blob.size,
        })),
      }),
    })
    if (!response.ok) {
      // Der Admin hat kein Kennwortfeld: ein 401 heißt bei ihm, dass die
      // Sitzung (12 Stunden) abgelaufen ist. Bei gesperrtem Foto-Upload prüft
      // der Server die Sperre vor der Anmeldung (423): für einen angemeldeten
      // Admin gibt es sie nie, also bedeutet sie hier dasselbe.
      if (isAdmin && (response.status === 401 || response.status === 423)) {
        return { error: 'Sitzung abgelaufen – bitte im Admin-Bereich neu anmelden.' }
      }
      if (!isAdmin && response.status === 401 && !needsPassword) {
        // Die gemerkte Sitzung gilt nicht mehr: das Kennwortfeld kommt zurück.
        onAccessLost?.()
        return { error: 'Bitte gib das Kennwort vom Empfang ein.' }
      }
      const body = await response.json().catch(() => null)
      return { error: body?.error ?? 'Hochladen fehlgeschlagen. Bitte versuch es erneut.' }
    }
    if (needsPassword) {
      // Tickets gibt es nur für ein richtiges Kennwort - und der Server hat
      // dabei die Sitzung gesetzt, das Feld wird nicht mehr gebraucht.
      setPassword('')
      onAccessGranted?.()
    }
    return (await response.json()) as { tickets: UploadTicket[] }
  }

  const uploadOneFile = async (
    index: number,
    selected: SelectedFile,
    ticket: UploadTicket,
    preview: PreviewImage,
    signal: AbortSignal,
    timeoutMs: number
  ) => {
    updateFile(index, { status: 'uploading', message: undefined })
    const result = await uploadAndRegister(selected, ticket, preview, name.trim(), {
      signal,
      timeoutMs,
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
    if (needsPassword && !password.trim()) {
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

    // Ab hier ist die Eingabe gültig: der Name steht in den anderen Formularen
    // schon bereit.
    remember(name)

    const controller = new AbortController()
    abortRef.current = controller
    setCancelled(false)
    setSubmitting(true)
    try {
      for (let start = 0; start < queue.length; start += FILES_PER_GROUP) {
        if (controller.signal.aborted) break
        const group = queue.slice(start, start + FILES_PER_GROUP)
        // Vorschauen zuerst: ihre Größe geht in die Ticket-Anfrage und wird
        // fest signiert. Das Ticket (15 Minuten) läuft so erst nach der
        // Verkleinerung los.
        const previews = await Promise.all(
          group.map(({ selected }) => createPreviewImage(selected.file))
        )
        if (controller.signal.aborted) break
        const ticketsResult = await requestTickets(
          group.map(({ selected }) => selected),
          previews,
          controller.signal
        )
        if ('error' in ticketsResult) {
          setFormError(ticketsResult.error)
          break
        }
        // Die Gruppe teilt sich die Leitung: das Limit richtet sich nach ihren Bytes.
        const timeoutMs = uploadTimeoutMs(group.reduce((sum, { selected }) => sum + selected.file.size, 0))
        await Promise.all(
          group.map(({ selected, index }, i) =>
            uploadOneFile(index, selected, ticketsResult.tickets[i], previews[i], controller.signal, timeoutMs)
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

  const cancelUpload = () => {
    restoreFocusRef.current = true
    setCancelled(true)
    abortRef.current?.abort()
  }

  const doneCount = selectedFiles.filter((f) => f.status === 'done').length
  const failedCount = selectedFiles.filter((f) => f.status === 'error' && !f.invalid).length
  // Nach "Abbrechen" zählt jedes gültige, nicht fertige Foto als abgebrochen -
  // auch die Gruppen, die gar nicht mehr gestartet wurden.
  const cancelledCount = cancelled
    ? selectedFiles.filter((f) => !f.invalid && f.status === 'pending').length
    : 0
  const wasPaused = selectedFiles.some((f) => f.status === 'error' && f.message === UPLOADS_PAUSED_MESSAGE)
  const summaryParts: string[] = []
  if (doneCount > 0) {
    summaryParts.push(`${pluralPhotos(doneCount, 'Foto', 'Fotos')} hochgeladen – danke!`)
  }
  if (failedCount > 0) {
    // Bei einer Pause bringt ein sofortiger Wiederholungsversuch nichts.
    const hint = wasPaused
      ? 'Das Hochladen ist gerade pausiert – bitte versucht es später noch einmal.'
      : 'Tippe erneut auf „Hochladen“.'
    summaryParts.push(
      `${pluralPhotos(failedCount, 'Foto konnte', 'Fotos konnten')} nicht hochgeladen werden. ${hint}`
    )
  }
  if (cancelledCount > 0) {
    summaryParts.push(
      `${pluralPhotos(cancelledCount, 'Foto wurde', 'Fotos wurden')} abgebrochen. Tippe auf „Hochladen“, um den Rest zu senden.`
    )
  }
  const statusText = submitting
    ? 'Bitte lass diese Seite geöffnet, bis alle Fotos hochgeladen sind.'
    : summaryParts.join(' ')

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
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
          className={textFieldClassName}
        />
      </div>

      {needsPassword && (
        <GuestPasswordField id="gallery-upload-password" value={password} onChange={setPassword} />
      )}

      <div>
        <label htmlFor="gallery-upload-category" className="block text-sm font-medium text-gray-700 mb-1.5">
          Kategorie
        </label>
        <select
          id="gallery-upload-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={textFieldClassName}
        >
          {uploadCategoriesFor(isAdmin).map((cat) => (
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
        <p className="mt-1.5 text-xs text-gray-500">Nur Fotos, keine Videos.</p>
      </div>

      {selectedFiles.length > 0 && (
        <ul className="space-y-1 max-h-72 overflow-y-auto">
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
                    <span data-testid="upload-preview-fallback" className="text-gray-500">
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
