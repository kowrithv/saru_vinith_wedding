'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUp, Camera, X } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import GalleryGrid from '@/components/gallery/GalleryGrid'
import GalleryUploadForm from '@/components/gallery/GalleryUploadForm'
import GuestPasswordField from '@/components/ui/GuestPasswordField'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'
import { useGuestAccess } from '@/lib/use-guest-access'

// So oft schaut die offene Galerie nach neuen Fotos (nicht während eines Uploads,
// nicht im versteckten Tab). Auf der Feier haben viele die Galerie gleichzeitig
// offen: 30 Sekunden halten die Last klein und fühlen sich trotzdem lebendig an.
const REFRESH_MS = 30_000

// Wer weiter unten im Raster ist, darf nicht erleben, dass sich unter dem Finger
// alles verschiebt: neue Fotos kommen dann erst auf Tipp. Oben (fast am Anfang)
// werden sie gleich eingesetzt.
const NEAR_TOP_PX = 150

function sameIds(a: GalleryPhotoView[], b: GalleryPhotoView[]): boolean {
  return a.length === b.length && a.every((photo, index) => photo.id === b[index].id)
}

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
  // Nach dem ersten Öffnen bleibt das Formular im DOM und wird nur versteckt:
  // "Schließen" soll laufende Uploads (und Eingaben) nicht verwerfen.
  const [uploadFormMounted, setUploadFormMounted] = useState(false)
  const uploadPanelRef = useRef<HTMLDivElement>(null)
  // Läuft gerade ein Upload? Dann lädt die Galerie nicht von selbst neu.
  const [uploading, setUploading] = useState(false)
  // Neuere Fotoliste vom Server, die noch nicht gezeigt wird (siehe NEAR_TOP_PX).
  const [pendingPhotos, setPendingPhotos] = useState<GalleryPhotoView[] | null>(null)
  const access = useGuestAccess()
  // Erst wenn feststeht, ob dieser Browser entsperrt ist (QR-Link wird dabei
  // eingelöst), wird die Liste geladen: sonst käme zuerst die gesperrte Antwort.
  const accessResolved = access.status !== 'checking'

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
    if (accessResolved) loadGallery()
  }, [accessResolved])

  // Regelmäßig nach neuen Fotos sehen, solange die Galerie offen ist und nichts
  // hochgeladen wird; auch gleich, wenn der Tab wieder sichtbar wird (z. B. nach
  // der Kamera-App). Ändert sich die Liste durch die Seite selbst (hochgeladen,
  // gelöscht), startet dieser Effekt neu und `active` verwirft die Antwort einer
  // noch laufenden Anfrage: sie kennt die Änderung nicht und ließe sonst ein eben
  // hochgeladenes Foto bis zur nächsten Runde wieder verschwinden.
  useEffect(() => {
    if (data.status !== 'unlocked' || uploading) return
    const shown = data.photos
    let active = true

    const refresh = () => {
      if (document.hidden) return
      fetch('/api/gallery', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { unlocked?: boolean; photos?: GalleryPhotoView[] | null; uploadsLocked?: boolean } | null) => {
          if (!active) return
          if (!body?.unlocked || !body.photos) return
          const photos = body.photos
          const uploadsLocked = Boolean(body.uploadsLocked)
          setData((prev) =>
            prev.status === 'unlocked' && prev.uploadsLocked !== uploadsLocked ? { ...prev, uploadsLocked } : prev
          )
          if (sameIds(shown, photos)) {
            setPendingPhotos(null)
          } else if (window.scrollY < NEAR_TOP_PX) {
            setData((prev) => (prev.status === 'unlocked' ? { ...prev, photos } : prev))
            setPendingPhotos(null)
          } else {
            setPendingPhotos(photos)
          }
        })
        // Ein Fehler beim Nachladen ändert nichts am Gezeigten: die nächste
        // Runde versucht es wieder.
        .catch(() => {})
    }

    const timer = setInterval(refresh, REFRESH_MS)
    const onVisible = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [data, uploading])

  const handleBusyChange = useCallback((busy: boolean) => setUploading(busy), [])

  const showPendingPhotos = () => {
    if (!pendingPhotos) return
    setData((prev) => (prev.status === 'unlocked' ? { ...prev, photos: pendingPhotos } : prev))
    setPendingPhotos(null)
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault()
    setUnlockError(null)
    setUnlocking(true)
    try {
      const result = await access.unlock(password)
      if (!result.ok) {
        setUnlockError(result.error)
        return
      }
      setPassword('')
      loadGallery()
    } finally {
      setUnlocking(false)
    }
  }

  const handlePhotoDeleted = (photoId: string) => {
    setPendingPhotos(null)
    setData((prev) =>
      prev.status === 'unlocked' ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) } : prev
    )
  }

  // Das Formular bleibt offen: ein Gast lädt meist mehrere Fotos auf einmal
  // hoch, und das Formular zeigt den Fortschritt und eventuelle Fehler der
  // übrigen Fotos. Geschlossen wird es nur über den Button.
  const handleUploaded = (photo: GalleryPhotoView) => {
    setPendingPhotos(null)
    setData((prev) => (prev.status === 'unlocked' ? { ...prev, photos: [photo, ...prev.photos] } : prev))
  }

  // Wie viele Fotos der Server mehr kennt, als gezeigt werden (nur Neue zählen, ein
  // gelöschtes Foto ist keine Meldung wert).
  const newPhotoCount =
    pendingPhotos && data.status === 'unlocked'
      ? pendingPhotos.filter((photo) => !data.photos.some((shown) => shown.id === photo.id)).length
      : 0

  return (
    // pb-28 statt pb-16: der schwebende Upload-Knopf (fixed, unten rechts)
    // darf bei kurzem Inhalt nicht auf dem Formular-Ende und "Abbrechen" liegen.
    <div className="pt-24 pb-28">
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
              <GuestPasswordField
                id="gallery-password"
                value={password}
                onChange={setPassword}
                linkRejected={access.linkRejected}
              />
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
                  onClick={() => {
                    setShowUploadForm((v) => !v)
                    setUploadFormMounted(true)
                  }}
                  aria-expanded={showUploadForm}
                  aria-controls="gallery-upload-panel"
                  className="fixed bottom-6 right-6 z-30 flex items-center gap-2 bg-gold text-dark-blue font-medium px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-shadow"
                >
                  {showUploadForm ? <X size={18} /> : <Camera size={18} />}
                  {showUploadForm ? 'Schließen' : 'Fotos hochladen'}
                </button>

                {uploadFormMounted && (
                  <div id="gallery-upload-panel" ref={uploadPanelRef} hidden={!showUploadForm} className="scroll-mt-28">
                    <Card padding="lg" className="max-w-xl mx-auto mb-10">
                      <GalleryUploadForm
                        hasAccess={access.status === 'unlocked'}
                        onAccessGranted={access.markUnlocked}
                        onAccessLost={access.markLocked}
                        onUploaded={handleUploaded}
                        onBusyChange={handleBusyChange}
                      />
                    </Card>
                  </div>
                )}
              </>
            )}

            {newPhotoCount > 0 && (
              <div className="sticky top-20 z-20 mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={showPendingPhotos}
                  className="flex items-center gap-2 rounded-full bg-dark-blue px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-dark-blue-light"
                >
                  <ArrowUp size={16} aria-hidden="true" />
                  {newPhotoCount === 1 ? '1 neues Foto anzeigen' : `${newPhotoCount} neue Fotos anzeigen`}
                </button>
              </div>
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
