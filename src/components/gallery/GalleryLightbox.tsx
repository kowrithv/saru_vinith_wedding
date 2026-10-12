'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [downloadError, setDownloadError] = useState<string | null>(null)
  // Statt eines Effekts, der imageSrc bei jedem Foto-Wechsel zurücksetzen
  // müsste: nur die ID des zuletzt fehlgeschlagenen Fotos merken. Das
  // "Zurücksetzen" passiert dadurch automatisch (ein neues Foto hat eine
  // andere ID, der Vergleich wird wieder false), kein set-state-in-effect
  // nötig.
  const [failedPhotoId, setFailedPhotoId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const photo = photos[index]
  const deleteToken = photo ? getDeleteToken(photo.id) : undefined
  const imageSrc = photo && failedPhotoId === photo.id ? photo.thumbUrl : photo?.originalUrl

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

  // Fokus in den Dialog holen (Tab bleibt sonst auf dem Hintergrund),
  // Seiten-Scroll sperren (sonst scrollt die Seite hinter dem Overlay auf
  // iOS beim Wischen weiter) und beides beim Schließen wieder herstellen -
  // Scroll-Sperre nach demselben Muster wie Navigation.tsx.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      previouslyFocused?.focus()
    }
  }, [])

  if (!photo) return null

  const handleDelete = async () => {
    if (!deleteToken) return
    if (!window.confirm('Dieses Foto wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return
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

  const handleDownload = async () => {
    setDownloadError(null)
    try {
      // Ein normaler <a download href="https://..."> wird von Browsern bei
      // Cross-Origin-URLs ignoriert (die Datei öffnet sich nur, statt
      // gespeichert zu werden) - R2 liegt immer auf einer anderen Domain
      // als die Seite selbst. Ein Blob über denselben Origin umgeht das.
      const response = await fetch(photo.originalUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `foto-${photo.id}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch {
      setDownloadError('Herunterladen fehlgeschlagen. Bitte versuch es erneut.')
    }
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center outline-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Foto-Ansicht"
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
          src={imageSrc}
          alt={`Foto von ${photo.uploaderName}`}
          onError={() => setFailedPhotoId(photo.id)}
          className="max-h-[80vh] w-auto h-auto object-contain rounded-lg mx-auto"
        />
        <div className="text-center mt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleDownload}
            className="text-white/70 text-sm hover:text-white transition-colors"
          >
            Original herunterladen
          </button>
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
        {downloadError && <p className="text-red-400 text-sm text-center mt-2">{downloadError}</p>}
        <p className="text-white/40 text-xs mt-1 text-center">
          {index + 1} / {photos.length}
        </p>
      </div>
    </div>
  )
}
