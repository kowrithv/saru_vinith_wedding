'use client'

import { useEffect } from 'react'
import './globals.css'

// Letzte Auffangstelle, wenn schon das Layout scheitert: sie ersetzt die ganze
// Seite und braucht deshalb ein eigenes <html>. Bewusst ohne Komponenten aus
// dem Layout (Navigation, Schriften), nur schlichtes Markup.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[seite] Fehler im Layout:', error)
  }, [error])

  return (
    <html lang="de">
      <body className="bg-white font-sans text-gray-900 antialiased">
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-3xl font-semibold text-dark-blue">Das hat leider nicht geklappt</h1>
          <p className="text-sm text-gray-600">
            Bitte versuch es noch einmal. Wenn es wieder passiert, lade die Seite neu oder komm später zurück.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 rounded-full bg-dark-blue px-6 py-2.5 text-sm font-medium text-white"
          >
            Erneut versuchen
          </button>
        </main>
      </body>
    </html>
  )
}
