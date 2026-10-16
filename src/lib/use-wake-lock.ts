'use client'

import { useEffect } from 'react'

/**
 * Hält den Bildschirm wach, solange die Seite offen ist: ein Beamer-Laptop ohne
 * Eingaben würde sonst nach einer Weile dunkel. Der Browser gibt die Sperre frei,
 * sobald der Tab im Hintergrund ist; beim Zurückkommen wird sie neu angefragt.
 * Ohne die Funktion (ältere Browser) oder bei einer Ablehnung passiert nichts.
 */
export function useWakeLock(): void {
  useEffect(() => {
    let active = true
    let lock: WakeLockSentinel | null = null

    const request = async () => {
      if (lock?.released === false) return
      try {
        const next = await navigator.wakeLock?.request('screen')
        if (!next) return
        if (active) lock = next
        else void next.release()
      } catch {
        // Abgelehnt (z. B. Akku schwach): die Anzeige läuft trotzdem.
      }
    }

    const onVisible = () => {
      if (!document.hidden) void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [])
}
