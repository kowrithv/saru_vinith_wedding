'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// replace statt push: der Aufruf der unbekannten URL soll nicht im
// Verlauf bleiben, sonst führt "Zurück" von der Startseite wieder auf die
// 404-Seite und sofort erneut hierher.
export default function RedirectHome() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return null
}
