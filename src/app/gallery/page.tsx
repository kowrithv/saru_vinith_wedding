'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Camera, KeyRound } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import GalleryGrid from '@/components/gallery/GalleryGrid'
import GalleryUploadForm from '@/components/gallery/GalleryUploadForm'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'

type GalleryData =
  | { status: 'loading' }
  | { status: 'locked' }
  | { status: 'error' }
  | { status: 'unlocked'; photos: GalleryPhotoView[] }

export default function GalleryPage() {
  const [data, setData] = useState<GalleryData>({ status: 'loading' })
  const [password, setPassword] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)

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
        return res.json() as Promise<{ unlocked: boolean; photos: GalleryPhotoView[] | null }>
      })
      .then((body) => {
        if (!body) return
        setData(body.unlocked && body.photos ? { status: 'unlocked', photos: body.photos } : { status: 'locked' })
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
      prev.status === 'unlocked' ? { status: 'unlocked', photos: prev.photos.filter((p) => p.id !== photoId) } : prev
    )
  }

  const handleUploaded = (photo: GalleryPhotoView) => {
    setData((prev) => (prev.status === 'unlocked' ? { status: 'unlocked', photos: [photo, ...prev.photos] } : prev))
    setShowUploadForm(false)
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
      </div>
    </div>
  )
}
