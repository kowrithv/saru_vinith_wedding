import { useCallback, useEffect, useRef, useState } from 'react'

// Die offene Seite sieht alle 30 Sekunden nach Neuem (Gästebuch, Erinnerungen); die
// Galerie macht dasselbe in ihrer Seite. Nicht im versteckten Tab, und gleich, wenn
// der Tab wieder sichtbar wird (z. B. nach der Kamera-App).
const REFRESH_MS = 30_000

// Wer weiter unten ist, soll nichts springen sehen: neue Einträge kommen dann erst
// auf Tipp (Knopf "N neue ... anzeigen"). Oben (fast am Anfang) werden sie gleich
// eingesetzt.
const NEAR_TOP_PX = 150

interface LiveListOptions<T> {
  url: string
  /** Was die Seite gerade zeigt. */
  shown: T[]
  /** Erst nach dem ersten erfolgreichen Laden (nicht bei einem Ladefehler). */
  enabled: boolean
  /** Kennzeichnet einen Eintrag samt allem, was sich an ihm ändern kann. */
  keyOf: (item: T) => string
  /** Die Liste aus einer Antwort; null: Antwort unbrauchbar, nichts tun. */
  parse: (body: unknown) => T[] | null
  /** Die neue Liste jetzt zeigen. */
  onApply: (items: T[]) => void
  /** Wird bei jeder vollständigen Antwort aufgerufen (z. B. für Nebenwerte). */
  onBody?: (body: unknown) => void
}

export interface LiveList {
  /** Wie viele Einträge der Server mehr kennt, als gezeigt werden (nur Neue zählen). */
  newCount: number
  /** Die wartenden Einträge zeigen und nach oben scrollen. */
  showNew: () => void
}

/**
 * Hält eine offene Liste aktuell, ohne sie neu zu laden und ohne etwas springen zu
 * lassen. Die Anfrage trägt den ETag der letzten Antwort: ohne Änderung kommt ein
 * kleines 304 zurück statt der ganzen Liste.
 */
export function useLiveList<T>({ url, shown, enabled, keyOf, parse, onApply, onBody }: LiveListOptions<T>): LiveList {
  const [pending, setPending] = useState<T[] | null>(null)
  const etagRef = useRef<string | null>(null)
  // Die Aufrufer übergeben frische Funktionen bei jedem Render: das darf den Takt nicht
  // neu starten, deshalb liegen sie in einem Ref.
  const callbacks = useRef({ keyOf, parse, onApply, onBody })
  useEffect(() => {
    callbacks.current = { keyOf, parse, onApply, onBody }
  })

  useEffect(() => {
    if (!enabled) return
    let active = true

    const refresh = () => {
      if (document.hidden) return
      const knownEtag = etagRef.current
      fetch(url, {
        cache: 'no-store',
        // Mit diesem Kopf kommt bei "nichts geändert" ein 304 ohne Liste zurück.
        headers: knownEtag ? { 'If-None-Match': knownEtag } : undefined,
      })
        .then(async (res) => {
          if (!active || res.status === 304 || !res.ok) return null
          return { body: (await res.json()) as unknown, etag: res.headers?.get('etag') ?? null }
        })
        .then((answer) => {
          if (!active || !answer) return
          const items = callbacks.current.parse(answer.body)
          if (!items) return
          // Erst jetzt merken: eine verworfene Antwort darf nicht als "gesehen" gelten.
          etagRef.current = answer.etag
          callbacks.current.onBody?.(answer.body)

          const { keyOf: key } = callbacks.current
          const same = shown.length === items.length && shown.every((item, index) => key(item) === key(items[index]))
          if (same) {
            setPending(null)
          } else if (window.scrollY < NEAR_TOP_PX) {
            callbacks.current.onApply(items)
            setPending(null)
          } else {
            setPending(items)
          }
        })
        // Ein Fehler beim Nachsehen ändert nichts am Gezeigten: die nächste Runde versucht es wieder.
        .catch(() => {})
    }

    // Ändert sich die Liste durch die Seite selbst (eigener Eintrag), startet dieser Effekt
    // neu und `active` verwirft die Antwort einer noch laufenden Anfrage: sie kennt die
    // Änderung nicht und ließe den eben geschriebenen Eintrag wieder verschwinden.
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
  }, [url, enabled, shown])

  const newCount = pending
    ? pending.filter((item) => !shown.some((current) => keyOf(current) === keyOf(item))).length
    : 0

  const showNew = useCallback(() => {
    if (!pending) return
    callbacks.current.onApply(pending)
    setPending(null)
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }, [pending])

  return { newCount, showNew }
}
