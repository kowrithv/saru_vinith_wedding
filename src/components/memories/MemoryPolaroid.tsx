'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { createPolaroidBlob, polaroidFileName } from '@/lib/polaroid-image'
import { savePolaroidFile } from '@/lib/polaroid-save'
import { polaroidCaption } from '@/lib/event-info'
import { couple } from '@/lib/site-content'

interface MemoryPolaroidProps {
  guestName: string
  photo: { thumbUrl: string; originalUrl: string }
}

// Das Foto einer Erinnerung als Polaroid nach dem Beispiel von Vinith: Foto,
// darunter der Anlass, die Namen des Brautpaars, das Datum und eine Zierlinie
// mit Herz; der Gast steht in einer kleinen Zeile. "Als Polaroid speichern"
// erzeugt dasselbe als Bilddatei zum Teilen (siehe polaroid-image.ts).
export default function MemoryPolaroid({ guestName, photo }: MemoryPolaroidProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savePolaroid = async () => {
    setError(null)
    setSaving(true)
    try {
      const blob = await createPolaroidBlob({
        photoUrl: photo.thumbUrl,
        guestName,
        coupleName: couple.combinedName,
        occasion: polaroidCaption.occasion,
        date: polaroidCaption.date,
      })
      // Am Handy über das Teilen-Menü (landet in den Fotos), sonst als Download.
      await savePolaroidFile(blob, polaroidFileName(guestName), `Polaroid von ${guestName}`)
    } catch {
      setError('Das Polaroid konnte nicht erstellt werden. Bitte versuch es erneut.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4">
      <figure className="relative mx-auto max-w-[17rem] rounded-2xl bg-[#f7f5f0] px-[6%] pb-[5%] pt-[7%] text-center shadow-[0_8px_22px_rgba(30,58,95,0.18)] ring-1 ring-black/5 -rotate-1 motion-reduce:rotate-0">
        <a href={photo.originalUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbUrl}
            alt={`Foto von ${guestName}`}
            loading="lazy"
            className="aspect-[876/1000] w-full object-cover object-[50%_30%]"
          />
        </a>

        <p className="mt-4 text-[0.6rem] font-semibold uppercase tracking-[0.32em] text-[#3a3a3a]">
          {polaroidCaption.occasion}
        </p>
        <p className="mt-1 font-script text-[2.1rem] leading-tight text-[#1c1c1c] [word-spacing:0.3em]">{couple.combinedName}</p>
        <p className="mt-1 font-serif text-[0.8rem] font-semibold tracking-[0.28em] text-[#3a3a3a]">
          {polaroidCaption.date}
        </p>

        <div className="mt-3 flex items-center justify-center gap-3" aria-hidden="true">
          <span className="h-px w-10 bg-[#1c1c1c]" />
          <svg data-testid="polaroid-heart" viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#1c1c1c" strokeWidth={2}>
            <path d="M12 21S4.5 16.4 2.5 11.8C1 8.2 3.3 5 6.5 5c2 0 3.7 1.1 5.5 3.2C13.8 6.1 15.5 5 17.5 5c3.2 0 5.5 3.2 4 6.8C19.5 16.4 12 21 12 21Z" />
          </svg>
          <span className="h-px w-10 bg-[#1c1c1c]" />
        </div>

        <figcaption className="mt-3 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-gray-600">
          Erinnerung von {guestName}
        </figcaption>
      </figure>

      <p className="mt-3 text-center text-xs text-gray-600">Das Foto steht auch in der Galerie.</p>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
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
