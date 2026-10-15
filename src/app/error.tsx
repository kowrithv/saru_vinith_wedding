'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Lotus from '@/components/ui/Lotus'

// Fängt Fehler beim Anzeigen einer Seite ab: statt der englischen
// Standardseite von Next.js ein klarer deutscher Satz und der nächste Schritt.
// Technische Einzelheiten sehen Gäste nicht, sie landen im Log.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[seite] Fehler beim Anzeigen:', error)
  }, [error])

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-12 text-center sm:px-6">
        <Lotus size={40} className="text-gold" />
        <h1 className="font-display text-3xl font-semibold text-dark-blue">Das hat leider nicht geklappt</h1>
        <p className="max-w-sm text-sm text-gray-600">
          Bitte versuch es noch einmal. Wenn es wieder passiert, lade die Seite neu oder komm später zurück.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-dark-blue px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-dark-blue-light"
          >
            Erneut versuchen
          </button>
          <Link href="/" className="text-sm font-medium text-dark-blue underline underline-offset-4">
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  )
}
