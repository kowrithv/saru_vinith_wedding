'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'
import { formatPhotoMoment } from '@/lib/format-time'
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

  const moment = formatPhotoMoment(photo.createdAt)

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
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center outline-none"
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

      <div
        data-testid="lightbox-card"
        className="mx-8 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#0f1724] p-3 text-white shadow-2xl ring-1 ring-white/10 sm:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={`Foto von ${photo.uploaderName}`}
          onError={() => setFailedPhotoId(photo.id)}
          className="mx-auto max-h-[66vh] w-auto max-w-full rounded-xl object-contain"
        />

        <div data-testid="lightbox-info" className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="truncate font-semibold">Von {photo.uploaderName}</p>
            <p className="text-xs text-white/70">
              <span>{photo.category}</span>
              {moment && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span>{moment}</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="flex-shrink-0 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-dark-blue-dark transition-colors hover:bg-gold-light"
          >
            Original herunterladen
          </button>
        </div>

        {deleteToken && (
          <p className="mt-3 border-t border-white/10 px-1 pt-3 text-xs text-white/60">
            <span>Das ist dein Foto · </span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 underline underline-offset-2 transition-colors hover:text-red-300 disabled:opacity-50"
            >
              <Trash2 size={12} />
              {deleting ? 'Wird gelöscht...' : 'Löschen'}
            </button>
          </p>
        )}
        {deleteError && <p className="mt-2 px-1 text-sm text-red-300">{deleteError}</p>}
        {downloadError && <p className="mt-2 px-1 text-sm text-red-300">{downloadError}</p>}
        <p className="mt-3 text-center text-xs text-white/40">
          {index + 1} / {photos.length}
        </p>
      </div>
    </div>
  )
}
