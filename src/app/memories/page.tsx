'use client'

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Camera, Heart, Send, User, X } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import GuestPasswordField from '@/components/ui/GuestPasswordField'
import EmptyState from '@/components/ui/EmptyState'
import MemoryPolaroid from '@/components/memories/MemoryPolaroid'
import { textFieldClassName } from '@/lib/form-styles'
import { MEMORY_PHOTO_CATEGORY } from '@/lib/gallery-categories'
import { saveDeleteToken } from '@/lib/gallery-delete-tokens'
import {
  IMAGE_CONTENT_TYPE_EXTENSIONS,
  MAX_ORIGINAL_BYTES,
  resolveImageContentType,
} from '@/lib/gallery-upload-limits'
import { uploadPhotoForTicket } from '@/lib/photo-upload'
import { useGuestAccess } from '@/lib/use-guest-access'
import { useGuestName } from '@/lib/use-guest-name'
import { formatEntryMoment } from '@/lib/format-time'
import { cn } from '@/lib/utils'

interface MemoryEntry {
  id: number
  name: string
  message: string
  createdAt: string
  /** Es gibt ein Foto, auch wenn dieser Browser es (noch) nicht sieht. */
  hasPhoto: boolean
  photo: { id: string; thumbUrl: string; originalUrl: string } | null
}

export default function MemoriesPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  // Der Name wird in allen Formularen nur einmal getippt.
  const { name, setName, remember } = useGuestName()
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  // Der Server sagt, ob Fotos gerade angehängt werden können (Notaus).
  const [photosEnabled, setPhotosEnabled] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  // Neuer key setzt das (unkontrollierte) Datei-Feld zurück.
  const [photoInputKey, setPhotoInputKey] = useState(0)
  const access = useGuestAccess()
  // Das Feld erscheint nur, solange dieser Browser nicht entsperrt ist.
  const needsPassword = access.status === 'locked'

  // Erst laden, wenn feststeht, ob dieser Browser entsperrt ist: die Fotos
  // liefert der Server nur mit Sitzung (QR-Link auf dieser Seite löst sie erst
  // einen Augenblick nach dem Öffnen ein), und ein späteres Entsperren lädt neu.
  const accessResolved = access.status !== 'checking'
  const unlocked = access.status === 'unlocked'
  useEffect(() => {
    if (!accessResolved) return
    let active = true
    fetch('/api/memories')
      .then((res) => (res.ok ? res.json() : { entries: [], photosEnabled: false }))
      .then((data: { entries: MemoryEntry[]; photosEnabled?: boolean }) => {
        if (!active) return
        setEntries(data.entries)
        setPhotosEnabled(Boolean(data.photosEnabled))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [accessResolved, unlocked])

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setPhotoError(null)
    setPhotoFile(null)
    if (!file) return
    if (!IMAGE_CONTENT_TYPE_EXTENSIONS.has(resolveImageContentType(file))) {
      setPhotoError('Dateityp nicht unterstützt. Bitte wähle ein Foto (JPG, PNG, WebP oder HEIC).')
      return
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      setPhotoError('Das Foto ist zu groß (max. 20 MB).')
      return
    }
    setPhotoFile(file)
  }

  const removePhoto = () => {
    setPhotoFile(null)
    setPhotoError(null)
    setPhotoInputKey((key) => key + 1)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedMessage = message.trim()
    if (!name.trim()) {
      setError('Bitte gib deinen Namen ein.')
      return
    }
    if (trimmedMessage.length < 10) {
      setError('Deine Erinnerung ist zu kurz. Bitte schreib mindestens 10 Zeichen.')
      return
    }
    if (needsPassword && !password.trim()) {
      setError('Bitte gib das Kennwort vom Empfang ein.')
      return
    }

    remember(name)
    setSubmitting(true)
    try {
      // Mit Foto: erst die Übertragung nach R2, dann wird der Eintrag mit dem
      // Ticket gespeichert. Scheitert der Upload, bleibt der Text stehen.
      let ticket: string | undefined
      if (photoFile) {
        setUploadingPhoto(true)
        const upload = await uploadPhotoForTicket({
          file: photoFile,
          contentType: resolveImageContentType(photoFile),
          category: MEMORY_PHOTO_CATEGORY,
          password: needsPassword ? password : undefined,
        })
        setUploadingPhoto(false)
        if (!upload.ok) {
          setError(upload.error)
          if (upload.unauthorized) access.markLocked()
          return
        }
        ticket = upload.ticket
      }

      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          message: trimmedMessage,
          ...(ticket ? { ticket } : {}),
          ...(needsPassword ? { password } : {}),
        }),
      })
      if (response.status === 401) {
        // Mit Kennwort: vertippt. Ohne: die gemerkte Sitzung gilt nicht mehr
        // (abgelaufen oder Kennwort gewechselt) - das Feld wieder zeigen.
        setError(needsPassword ? 'Falsches Kennwort.' : 'Bitte gib das Kennwort vom Empfang ein.')
        access.markLocked()
        return
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error ?? 'Erinnerung konnte nicht gespeichert werden. Bitte versuch es erneut.')
        return
      }
      const data = (await response.json()) as { entry: MemoryEntry; deleteToken?: string }
      // Das Foto ist auch in der Galerie: das Lösch-Token bleibt auf diesem Gerät.
      if (data.deleteToken && data.entry.photo) saveDeleteToken(data.entry.photo.id, data.deleteToken)
      setEntries((prev) => [data.entry, ...prev])
      setMessage('')
      setPassword('')
      removePhoto()
      // Der Server hat mit dem richtigen Kennwort die Sitzung gesetzt.
      if (needsPassword) access.markUnlocked()
    } catch {
      setError('Erinnerung konnte nicht gespeichert werden. Bitte versuch es erneut.')
    } finally {
      setUploadingPhoto(false)
      setSubmitting(false)
    }
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Erinnerungen"
          subtitle="Teilt eure Erinnerungen an uns und diesen Tag."
        />

        <Card padding="lg" className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-dark-blue rounded-xl flex items-center justify-center">
              <Heart size={18} className="text-white" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-dark-blue">Erinnerung teilen</h3>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="memories-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                <User size={14} className="inline mr-1" />
                Dein Name
              </label>
              <input
                id="memories-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wie heißt du?"
                maxLength={60}
                className={textFieldClassName}
              />
            </div>

            {needsPassword && (
              <GuestPasswordField
                id="memories-password"
                value={password}
                onChange={setPassword}
                linkRejected={access.linkRejected}
              />
            )}

            <div className="md:col-span-2">
              <label htmlFor="memories-message" className="block text-sm font-medium text-gray-700 mb-1.5">
                <Heart size={14} className="inline mr-1" />
                Deine Erinnerung
              </label>
              <textarea
                id="memories-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ein Moment, ein Lachen, ein Satz – was bleibt dir von diesem Tag?"
                rows={4}
                maxLength={500}
                className={cn(textFieldClassName, 'resize-none')}
              />
              <p className="text-xs text-gray-500 text-right mt-1">{message.length}/500</p>
            </div>

            {photosEnabled && (
              <div className="md:col-span-2">
                <label htmlFor="memories-photo" className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Camera size={14} className="inline mr-1" />
                  Foto (optional)
                </label>
                <input
                  key={photoInputKey}
                  id="memories-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-champagne file:px-4 file:py-2 file:text-sm file:font-medium file:text-dark-blue"
                />
                <p className="mt-1.5 text-xs text-gray-500">Nur Fotos, keine Videos.</p>
                {photoFile && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <span className="break-all">{photoFile.name}</span>
                    <button
                      type="button"
                      onClick={removePhoto}
                      aria-label="Foto entfernen"
                      className="rounded-full p-1 text-gray-500 hover:bg-champagne hover:text-dark-blue"
                    >
                      <X size={14} />
                    </button>
                  </p>
                )}
                {photoError && <p className="mt-2 text-sm text-red-600">{photoError}</p>}
                <p className="mt-1 text-xs text-gray-500">Das Foto erscheint auch in der Galerie.</p>
              </div>
            )}

            {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}

            <div className="md:col-span-2">
              <Button type="submit" size="lg" disabled={submitting} className="w-full">
                <Send size={16} />
                {uploadingPhoto ? 'Foto wird hochgeladen...' : submitting ? 'Wird geteilt...' : 'Erinnerung teilen'}
              </Button>
            </div>
          </form>
        </Card>

        {entries.length === 0 ? (
          <EmptyState title="Noch keine Erinnerungen" description="Teilt eure erste." />
        ) : (
          <div className="columns-1 md:columns-2 gap-4">
            {entries.map((entry) => (
              <Card key={entry.id} variant="ornate" className="relative overflow-hidden mb-4 break-inside-avoid">
                <div className="mb-2 pl-2">
                  <p className="font-semibold text-dark-blue truncate">{entry.name}</p>
                  <p className="text-xs text-gray-600">{formatEntryMoment(entry.createdAt)}</p>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed italic pl-2">&quot;{entry.message}&quot;</p>
                {entry.photo ? (
                  <MemoryPolaroid guestName={entry.name} photo={entry.photo} />
                ) : (
                  entry.hasPhoto && (
                    <p className="mt-3 flex items-center gap-2 pl-2 text-xs text-gray-500">
                      <Camera size={14} aria-hidden="true" />
                      Foto – sichtbar nach dem Entsperren (QR-Code oder Kennwort)
                    </p>
                  )
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
