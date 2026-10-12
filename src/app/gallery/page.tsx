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
