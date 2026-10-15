'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import FloralSpray from '@/components/ui/FloralSpray'
import Lotus from '@/components/ui/Lotus'
import { createPolaroidBlob, polaroidFileName } from '@/lib/polaroid-image'
import { couple } from '@/lib/site-content'

interface MemoryPolaroidProps {
  guestName: string
  photo: { thumbUrl: string; originalUrl: string }
}

// Das Foto einer Erinnerung als Polaroid: Bordeaux-Banner mit den Namen des
// Brautpaars, Unterschrift des Gastes, Blüten in den Ecken. "Als Polaroid
// speichern" erzeugt dasselbe als Bilddatei zum Teilen.
export default function MemoryPolaroid({ guestName, photo }: MemoryPolaroidProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savePolaroid = async () => {
    setError(null)
    setSaving(true)
    try {
      const blob = await createPolaroidBlob(photo.thumbUrl, guestName, couple.combinedName)
      // Ein <a download> mit Blob-Adresse (dieselbe Herkunft) wird auch von
      // iPhone-Safari und Android-Chrome als Speichern behandelt.
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = polaroidFileName(guestName)
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Das Polaroid konnte nicht erstellt werden. Bitte versuch es erneut.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4">
      <figure className="relative mx-auto max-w-xs rounded-sm bg-white p-3 pb-4 shadow-[0_8px_22px_rgba(30,58,95,0.18)] ring-1 ring-gold/50 -rotate-1 motion-reduce:rotate-0">
        <FloralSpray className="absolute -left-3 -top-3 h-16 w-16 text-bordeaux" />
        <FloralSpray className="absolute -bottom-3 -right-3 h-16 w-16 rotate-180 text-bordeaux" />

        <a href={photo.originalUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbUrl}
            alt={`Foto von ${guestName}`}
            loading="lazy"
            className="aspect-square w-full object-cover object-[50%_35%]"
          />
        </a>

        <div className="mt-3 flex items-center justify-center gap-2 bg-bordeaux px-2 py-2 text-champagne-light outline outline-1 -outline-offset-4 outline-gold/70">
          <Lotus size={14} className="text-gold" />
          <span className="font-display text-lg font-semibold tracking-wide">{couple.combinedName}</span>
          <Lotus size={14} className="text-gold" />
        </div>

        <figcaption className="flex items-baseline justify-between gap-3 px-1 pt-3">
          <span className="font-script text-3xl leading-none text-dark-blue">{guestName}</span>
          <span className="text-xs text-gray-600">auch in der Galerie</span>
        </figcaption>
      </figure>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={savePolaroid}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full border-2 border-dark-blue px-4 py-1.5 text-sm font-medium text-dark-blue transition-colors hover:bg-dark-blue hover:text-white disabled:opacity-50"
        >
          <Download size={14} />
          {saving ? 'Wird erstellt...' : 'Als Polaroid speichern'}
        </button>
        <a
          href={photo.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-dark-blue underline underline-offset-4"
        >
          Original öffnen
        </a>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
