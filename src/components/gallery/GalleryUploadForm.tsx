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
