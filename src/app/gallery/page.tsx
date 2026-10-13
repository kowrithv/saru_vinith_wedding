'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, KeyRound, X } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import GalleryGrid from '@/components/gallery/GalleryGrid'
import GalleryUploadForm from '@/components/gallery/GalleryUploadForm'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'
import { textFieldClassName } from '@/lib/form-styles'

type GalleryData =
  | { status: 'loading' }
  | { status: 'locked' }
  | { status: 'error' }
  | { status: 'unlocked'; photos: GalleryPhotoView[]; uploadsLocked: boolean }

export default function GalleryPage() {
  const [data, setData] = useState<GalleryData>({ status: 'loading' })
  const [password, setPassword] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const uploadPanelRef = useRef<HTMLDivElement>(null)

  // Der Button schwebt am unteren Bildschirmrand, das Formular steht aber
  // über dem Raster: ohne Scrollen und Fokus sähe ein Gast, der weiter unten
  // ist, nach dem Tippen scheinbar nichts passieren.
  useEffect(() => {
    if (!showUploadForm) return
    const panel = uploadPanelRef.current
    panel?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    panel?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
  }, [showUploadForm])

  const loadGallery = () => {
    fetch('/api/gallery')
      .then((res) => {
        // Ein echter Server-/Netzwerkfehler ist kein "gesperrt" - sonst
        // zeigen wir Gästen fälschlich ein Kennwort-Formular, obwohl die
        // Galerie eigentlich öffentlich ist und nur gerade nicht erreichbar
        // war.
        if (!res.ok) {
          setData({ status: 'error' })
          return undefined
        }
        return res.json() as Promise<{ unlocked: boolean; photos: GalleryPhotoView[] | null; uploadsLocked?: boolean }>
      })
      .then((body) => {
        if (!body) return
        setData(
          body.unlocked && body.photos
            ? { status: 'unlocked', photos: body.photos, uploadsLocked: Boolean(body.uploadsLocked) }
            : { status: 'locked' }
        )
      })
      .catch(() => setData({ status: 'error' }))
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
      prev.status === 'unlocked' ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) } : prev
    )
  }

  // Das Formular bleibt offen: ein Gast lädt meist mehrere Fotos auf einmal
  // hoch, und das Formular zeigt den Fortschritt und eventuelle Fehler der
  // übrigen Fotos. Geschlossen wird es nur über den Button.
  const handleUploaded = (photo: GalleryPhotoView) => {
    setData((prev) => (prev.status === 'unlocked' ? { ...prev, photos: [photo, ...prev.photos] } : prev))
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionTitle title="Galerie" subtitle="Momente, die wir für immer in Erinnerung behalten." />

        {data.status === 'error' && (
          <Card padding="lg" className="max-w-md mx-auto text-center">
            <p className="text-sm text-gray-600 mb-4">
              Galerie konnte nicht geladen werden. Bitte versuch es erneut.
            </p>
            <Button onClick={loadGallery}>Erneut versuchen</Button>
          </Card>
        )}

        {data.status === 'locked' && (
          <Card padding="lg" className="max-w-md mx-auto">
            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label htmlFor="gallery-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  <KeyRound size={14} className="inline mr-1" />
                  Kennwort vom Empfang
                </label>
                <input
                  id="gallery-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kennwort"
                  className={textFieldClassName}
                />
              </div>
              {unlockError && <p className="text-sm text-red-600">{unlockError}</p>}
              <Button type="submit" size="lg" disabled={unlocking} className="w-full">
                {unlocking ? 'Wird geprüft...' : 'Galerie ansehen'}
              </Button>
            </form>
          </Card>
        )}

        {data.status === 'unlocked' && (
          <>
            {data.uploadsLocked ? (
              <p role="status" className="max-w-xl mx-auto mb-8 text-center text-sm text-gray-600">
                Das Hochladen ist gerade pausiert. Die Fotos könnt ihr euch weiterhin ansehen.
              </p>
            ) : (
              <>
                {/* z-30: unter dem Mobil-Menü (z-40), der Navigation und der
                    Lightbox (z-50), sonst läge der Button auf dem geöffneten Menü. */}
                <button
                  type="button"
                  onClick={() => setShowUploadForm((v) => !v)}
                  aria-expanded={showUploadForm}
                  aria-controls="gallery-upload-panel"
                  className="fixed bottom-6 right-6 z-30 flex items-center gap-2 bg-gold text-dark-blue font-medium px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-shadow"
                >
                  {showUploadForm ? <X size={18} /> : <Camera size={18} />}
                  {showUploadForm ? 'Schließen' : 'Fotos hochladen'}
                </button>

                {showUploadForm && (
                  <div id="gallery-upload-panel" ref={uploadPanelRef} className="scroll-mt-28">
                    <Card padding="lg" className="max-w-xl mx-auto mb-10">
                      <GalleryUploadForm onUploaded={handleUploaded} />
                    </Card>
                  </div>
                )}
              </>
            )}

            <GalleryGrid
              photos={data.photos}
              onPhotoDeleted={handlePhotoDeleted}
              emptyMessage={data.uploadsLocked ? 'Noch keine Fotos.' : undefined}
            />
          </>
        )}
      </div>
    </div>
  )
}
