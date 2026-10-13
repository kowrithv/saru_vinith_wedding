'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, LogOut, ShieldAlert, Trash2, Trophy } from 'lucide-react'
import Card from '@/components/ui/Card'
import SectionTitle from '@/components/ui/SectionTitle'
import GalleryUploadForm from '@/components/gallery/GalleryUploadForm'
import { formatTime } from '@/lib/format-time'
import CollapsibleSection from '@/components/admin/CollapsibleSection'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'
import { cn } from '@/lib/utils'

interface GuestbookEntry {
  id: number
  name: string
  message: string
  createdAt: string
}

interface MemoryEntry {
  id: number
  name: string
  message: string
  photoKey: string | null
  createdAt: string
}

interface Locks {
  guestbook: boolean
  memories: boolean
  who_votes: boolean
  gallery_upload: boolean
}

type GalleryMode = 'public' | 'password'

interface AdminDashboardProps {
  initialLocks: Locks
  initialGalleryMode: GalleryMode
}

const FEATURE_LABELS: Record<keyof Locks, string> = {
  guestbook: 'Gästebuch',
  memories: 'Erinnerungen',
  who_votes: 'Wer-von-uns-Abstimmung',
  gallery_upload: 'Foto-Upload',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminDashboard({ initialLocks, initialGalleryMode }: AdminDashboardProps) {
  const router = useRouter()
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([])
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([])
  const [locks, setLocks] = useState<Locks>(initialLocks)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Eigener Fehlerzustand: der allgemeine deleteError steht oben auf der
  // Seite und wäre beim Löschen eines Fotos weit unten außerhalb des Sichtfelds.
  const [galleryDeleteError, setGalleryDeleteError] = useState<string | null>(null)
  const [lockError, setLockError] = useState<string | null>(null)
  // Mehrere Schalter können gleichzeitig unterwegs sein (schnelles Tippen im
  // Notfall): jeder hängt an seiner eigenen Anfrage.
  const [togglingFeatures, setTogglingFeatures] = useState<ReadonlySet<keyof Locks>>(new Set())
  const [galleryMode, setGalleryMode] = useState<GalleryMode>(initialGalleryMode)
  const [galleryModeError, setGalleryModeError] = useState<string | null>(null)
  const [changingGalleryMode, setChangingGalleryMode] = useState(false)
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhotoView[]>([])
  const [memoryRecordMessage, setMemoryRecordMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [memoryRecord, setMemoryRecord] = useState<{ moves: number; seconds: number } | null>(null)

  useEffect(() => {
    fetch('/api/guestbook')
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data: { entries: GuestbookEntry[] }) => setGuestbookEntries(data.entries))
      .catch(() => {})

    fetch('/api/memories')
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data: { entries: MemoryEntry[] }) => setMemoryEntries(data.entries))
      .catch(() => {})

    // Admin sieht die Galerie unabhängig vom Modus (isAdminRequest-Bypass im
    // Backend), `photos` ist hier also immer ein Array, nie null.
    fetch('/api/gallery')
      .then((res) => (res.ok ? res.json() : { photos: [] }))
      .then((data: { photos: GalleryPhotoView[] | null }) => setGalleryPhotos(data.photos ?? []))
      .catch(() => {})

    // Der Admin sieht den aktuellen Memory-Rekord, damit ein unmöglicher Wert
    // (gefälscht per Skript) auffällt und sich zurücksetzen lässt.
    fetch('/api/memory-record')
      .then((res) => (res.ok ? res.json() : { record: null }))
      .then((data: { record: { moves: number; seconds: number } | null }) => setMemoryRecord(data.record))
      .catch(() => {})
  }, [])

  const deleteGuestbookEntry = async (id: number) => {
    setDeleteError(null)
    try {
      const response = await fetch(`/api/guestbook/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
        return
      }
      setGuestbookEntries((prev) => prev.filter((entry) => entry.id !== id))
    } catch {
      setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
    }
  }

  const deleteMemoryEntry = async (id: number) => {
    setDeleteError(null)
    try {
      const response = await fetch(`/api/memories/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
        return
      }
      setMemoryEntries((prev) => prev.filter((entry) => entry.id !== id))
    } catch {
      setDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
    }
  }

  const deleteGalleryPhoto = async (photo: GalleryPhotoView) => {
    // Ein gelöschtes Foto ist endgültig weg (Original und Vorschau in R2),
    // und der kleine Knopf wird beim Scrollen am Handy leicht getroffen.
    if (!window.confirm(`Foto von ${photo.uploaderName} wirklich endgültig löschen?`)) {
      return
    }
    setGalleryDeleteError(null)
    try {
      const response = await fetch(`/api/gallery/${photo.id}`, { method: 'DELETE' })
      if (!response.ok) {
        setGalleryDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
        return
      }
      setGalleryPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    } catch {
      setGalleryDeleteError('Löschen fehlgeschlagen. Bitte versuch es erneut.')
    }
  }

  const toggleLock = async (feature: keyof Locks) => {
    const next = !locks[feature]
    setLockError(null)
    setTogglingFeatures((prev) => new Set(prev).add(feature))
    try {
      const response = await fetch('/api/admin/write-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, locked: next }),
      })
      if (!response.ok) {
        setLockError('Umschalten fehlgeschlagen. Bitte versuch es erneut.')
        return
      }
      const data = (await response.json()) as { locks: Locks }
      // Nur den eigenen Schalter übernehmen: die Antwort enthält den
      // Gesamtstand zum Zeitpunkt ihrer Verarbeitung, und bei zwei schnell
      // aufeinanderfolgenden Änderungen kann die ältere Antwort später
      // eintreffen und die neuere überschreiben.
      setLocks((prev) => ({ ...prev, [feature]: data.locks[feature] ?? next }))
    } catch {
      setLockError('Umschalten fehlgeschlagen. Bitte versuch es erneut.')
    } finally {
      setTogglingFeatures((prev) => {
        const remaining = new Set(prev)
        remaining.delete(feature)
        return remaining
      })
    }
  }

  const changeGalleryMode = async (mode: GalleryMode) => {
    if (mode === galleryMode) return
    setGalleryModeError(null)
    setChangingGalleryMode(true)
    try {
      const response = await fetch('/api/admin/gallery-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      if (!response.ok) {
        setGalleryModeError('Umschalten fehlgeschlagen. Bitte versuch es erneut.')
        return
      }
      const data = (await response.json()) as { mode: GalleryMode }
      setGalleryMode(data.mode)
    } catch {
      setGalleryModeError('Umschalten fehlgeschlagen. Bitte versuch es erneut.')
    } finally {
      setChangingGalleryMode(false)
    }
  }

  const resetMemoryRecord = async () => {
    // Für Testspiele vor der Feier: der Rekord soll am Hochzeitstag bei null
    // beginnen.
    if (!window.confirm('Den Memory-Rekord aller Gäste wirklich zurücksetzen?')) return
    setMemoryRecordMessage(null)
    try {
      const response = await fetch('/api/memory-record', { method: 'DELETE' })
      if (response.ok) {
        setMemoryRecord(null)
        setMemoryRecordMessage({ ok: true, text: 'Rekord zurückgesetzt.' })
      } else if (response.status === 401) {
        // Die Admin-Sitzung läuft nach 12 Stunden ab - ein erneuter Versuch
        // würde nichts ändern.
        setMemoryRecordMessage({ ok: false, text: 'Sitzung abgelaufen – bitte neu anmelden.' })
      } else {
        setMemoryRecordMessage({ ok: false, text: 'Zurücksetzen fehlgeschlagen. Bitte versuch es erneut.' })
      }
    } catch {
      setMemoryRecordMessage({ ok: false, text: 'Zurücksetzen fehlgeschlagen. Bitte versuch es erneut.' })
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-start justify-between gap-4 mb-8">
          <SectionTitle title="Admin" subtitle="Einträge moderieren, Schreib-Sperren umschalten." centered={false} />
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-dark-blue transition-colors flex-shrink-0"
          >
            <LogOut size={16} />
            Abmelden
          </button>
        </div>

        <Card padding="lg" className="mb-8">
          <div className="space-y-5">
            {(Object.keys(FEATURE_LABELS) as (keyof Locks)[]).map((feature) => {
              const isLocked = locks[feature]
              return (
                <div key={feature} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldAlert size={20} className={isLocked ? 'text-red-600' : 'text-gray-400'} />
                    <div>
                      <p className="font-semibold text-dark-blue text-sm">{FEATURE_LABELS[feature]}</p>
                      <p className="text-xs text-gray-400">
                        {!isLocked
                          ? 'Erlaubt.'
                          : feature === 'gallery_upload'
                            ? 'Gesperrt für Gäste – du lädst weiter hoch.'
                            : 'Gesperrt.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isLocked}
                    aria-label={`Schreib-Sperre: ${FEATURE_LABELS[feature]}`}
                    onClick={() => toggleLock(feature)}
                    disabled={togglingFeatures.has(feature)}
                    className={cn(
                      'w-12 h-7 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50',
                      isLocked ? 'bg-red-500' : 'bg-gray-200'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                        isLocked ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              )
            })}
          </div>
          {lockError && (
            <p className="text-sm text-red-600 mt-4" role="alert">
              {lockError}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 pt-5 mt-5 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <Camera size={20} className="text-gray-400" />
              <div>
                <p className="font-semibold text-dark-blue text-sm">Galerie-Sichtbarkeit</p>
                <p className="text-xs text-gray-400">
                  {galleryMode === 'public' ? 'Öffentlich.' : 'Nur mit Kennwort.'}
                </p>
              </div>
            </div>
            <div
              className="flex rounded-full border border-gray-200 overflow-hidden"
              role="group"
              aria-label="Galerie-Sichtbarkeit"
            >
              <button
                type="button"
                onClick={() => changeGalleryMode('public')}
                disabled={changingGalleryMode}
                aria-pressed={galleryMode === 'public'}
                className={cn(
                  'px-4 py-1.5 text-xs font-medium transition-colors',
                  galleryMode === 'public' ? 'bg-dark-blue text-white' : 'bg-white text-gray-600'
                )}
              >
                Öffentlich
              </button>
              <button
                type="button"
                onClick={() => changeGalleryMode('password')}
                disabled={changingGalleryMode}
                aria-pressed={galleryMode === 'password'}
                className={cn(
                  'px-4 py-1.5 text-xs font-medium transition-colors',
                  galleryMode === 'password' ? 'bg-dark-blue text-white' : 'bg-white text-gray-600'
                )}
              >
                Kennwort
              </button>
            </div>
          </div>
          {galleryModeError && (
            <p className="text-sm text-red-600 mt-4" role="alert">
              {galleryModeError}
            </p>
          )}
        </Card>

        {deleteError && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {deleteError}
          </p>
        )}

        <div className="space-y-8">
          <CollapsibleSection id="admin-guestbook" title="Gästebuch" count={guestbookEntries.length}>
            <div className="space-y-3">
              {guestbookEntries.map((entry) => (
                <Card key={entry.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-dark-blue text-sm">{entry.name}</p>
                        <p className="text-xs text-gray-400">{formatDate(entry.createdAt)}</p>
                      </div>
                      <p className="text-sm text-gray-600">{entry.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteGuestbookEntry(entry.id)}
                      aria-label={`Löschen: Eintrag von ${entry.name}`}
                      className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="admin-memories" title="Erinnerungen" count={memoryEntries.length}>
            <div className="space-y-3">
              {memoryEntries.map((entry) => (
                <Card key={entry.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-dark-blue text-sm">{entry.name}</p>
                        <p className="text-xs text-gray-400">{formatDate(entry.createdAt)}</p>
                      </div>
                      <p className="text-sm text-gray-600">{entry.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteMemoryEntry(entry.id)}
                      aria-label={`Löschen: Eintrag von ${entry.name}`}
                      className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="admin-gallery" title="Galerie" count={galleryPhotos.length} defaultOpen>
            <Card padding="lg" className="mb-4">
              <GalleryUploadForm
                isAdmin
                onUploaded={(photo) => setGalleryPhotos((prev) => [photo, ...prev])}
              />
            </Card>
            {galleryDeleteError && (
              <p className="text-sm text-red-600 mb-3" role="alert">
                {galleryDeleteError}
              </p>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {galleryPhotos.map((photo) => (
                <div key={photo.id}>
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbUrl}
                      alt={`Foto von ${photo.uploaderName}`}
                      loading="lazy"
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    {/* Absichtlich immer sichtbar, nicht nur bei Hover: Hover
                        gibt es auf Touch-Geräten nicht (gleiche Lehre wie
                        beim Review der Gast-Galerie). */}
                    <button
                      type="button"
                      onClick={() => deleteGalleryPhoto(photo)}
                      aria-label={`Löschen: Foto von ${photo.uploaderName}`}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-2 hover:bg-black/80 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
                    <span>{photo.category}</span>
                    {photo.isOfficial && (
                      <span className="rounded-full bg-champagne px-1.5 py-0.5 text-[10px] font-medium text-dark-blue">
                        Offiziell
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>

        <Card className="mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <Trophy size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-dark-blue text-sm">Liebes-Memory</p>
                <p className="text-sm text-gray-600">
                  {memoryRecord
                    ? `Aktueller Rekord: ${memoryRecord.moves} Züge · ${formatTime(memoryRecord.seconds)}`
                    : 'Noch kein Rekord.'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Zurücksetzen z. B. nach Testspielen oder bei einem unmöglichen Wert.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetMemoryRecord}
              className="min-h-11 px-4 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Memory-Rekord zurücksetzen
            </button>
          </div>
          {memoryRecordMessage && (
            <p
              role={memoryRecordMessage.ok ? 'status' : 'alert'}
              className={cn('text-sm mt-3', memoryRecordMessage.ok ? 'text-green-700' : 'text-red-600')}
            >
              {memoryRecordMessage.text}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
