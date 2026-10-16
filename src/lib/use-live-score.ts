'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScoreSnapshot } from '@/lib/score'

/**
 * connecting: erste Verbindung · live: der Stream liefert · polling: der Stream steht,
 * die Seite fragt ersatzweise alle 3 s nach · login: kein gültiges Kennwort-Cookie.
 */
export type ScoreStatus = 'connecting' | 'live' | 'polling' | 'login'

const POLL_MS = 3000
// Der Server schickt alle 10 s ein Ping. Kommt 25 s lang nichts, ist die Leitung tot, auch
// wenn der Browser es nicht merkt (halb offene Verbindung im WLAN): neu verbinden.
const SILENCE_MS = 25_000

export function parseScore(value: unknown): ScoreSnapshot | null {
  if (typeof value !== 'object' || value === null) return null
  const { bride, groom, rev } = value as Record<string, unknown>
  const valid = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0
  return valid(bride) && valid(groom) && valid(rev) ? { bride, groom, rev } : null
}

export interface LiveScore {
  score: ScoreSnapshot | null
  status: ScoreStatus
  /** Übernimmt eine Antwort der eigenen Anfrage, wenn sie neuer ist als das Gezeigte. */
  accept: (next: ScoreSnapshot) => void
  /** Nach dem Anmelden: Verbindung neu aufbauen. */
  reconnect: () => void
}

/**
 * Hält den Punktestand live: ein offener Stream (Server-Sent Events) liefert jede
 * Änderung sofort. Reißt er ab, fragt die Seite alle 3 s nach, bis er wieder steht,
 * damit die Anzeige auch bei einem Proxy-Problem stimmt.
 */
export function useLiveScore(): LiveScore {
  const [score, setScore] = useState<ScoreSnapshot | null>(null)
  const [status, setStatus] = useState<ScoreStatus>('connecting')
  const [session, setSession] = useState(0)
  // Nach einem Abriss gilt der nächste Stand auch mit kleinerer Nummer (z. B. nach
  // einer eingespielten Sicherung); sonst zählen nur neuere.
  const forceNext = useRef(true)

  const accept = useCallback((next: ScoreSnapshot) => {
    setScore((prev) => (!prev || next.rev > prev.rev ? next : prev))
  }, [])

  const reconnect = useCallback(() => {
    setStatus('connecting')
    setSession((n) => n + 1)
  }, [])

  useEffect(() => {
    let active = true
    let source: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | undefined
    let silenceTimer: ReturnType<typeof setTimeout> | undefined
    forceNext.current = true

    const take = (next: ScoreSnapshot) => {
      const force = forceNext.current
      forceNext.current = false
      setScore((prev) => (!prev || force || next.rev > prev.rev ? next : prev))
    }

    const stopPolling = () => {
      clearInterval(pollTimer)
      pollTimer = undefined
    }

    const stopAll = () => {
      stopPolling()
      clearTimeout(silenceTimer)
      source?.close()
    }

    const poll = async () => {
      try {
        const response = await fetch('/api/score', { cache: 'no-store' })
        if (!active) return
        if (response.status === 401) {
          stopAll()
          setStatus('login')
          return
        }
        if (!response.ok) return
        const next = parseScore(await response.json())
        if (next && active) take(next)
        // Hat der Browser den Stream endgültig aufgegeben (Fehlerantwort), einen neuen öffnen.
        if (active && (!source || source.readyState === EventSource.CLOSED)) openStream()
      } catch {
        // Kein Netz: der nächste Takt versucht es wieder.
      }
    }

    const startPolling = () => {
      if (pollTimer === undefined) pollTimer = setInterval(poll, POLL_MS)
    }

    const armSilence = () => {
      clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        if (!active) return
        forceNext.current = true
        setStatus('polling')
        startPolling()
        openStream()
      }, SILENCE_MS)
    }

    const openStream = () => {
      source?.close()
      const stream = new EventSource('/api/score/stream')
      source = stream
      armSilence()

      stream.onmessage = (event: MessageEvent<string>) => {
        if (!active || source !== stream) return
        let next: ScoreSnapshot | null = null
        try {
          next = parseScore(JSON.parse(event.data))
        } catch {
          // Unlesbare Nachricht: ignorieren, die nächste Änderung bringt den ganzen Stand.
        }
        if (!next) return
        take(next)
        stopPolling()
        setStatus('live')
        armSilence()
      }
      stream.addEventListener('ping', () => {
        if (active && source === stream) armSilence()
      })
      stream.onerror = () => {
        if (!active || source !== stream) return
        forceNext.current = true
        setStatus('polling')
        startPolling()
      }
    }

    const start = async () => {
      try {
        const response = await fetch('/api/score', { cache: 'no-store' })
        if (!active) return
        if (response.status === 401) {
          setStatus('login')
          return
        }
        if (response.ok) {
          const next = parseScore(await response.json())
          if (next && active) take(next)
        }
      } catch {
        // Kein Netz: Stream und Abfrage versuchen es gleich selbst wieder.
      }
      if (active) openStream()
    }

    // Wieder im Netz oder Tab wieder sichtbar: sofort nachsehen, nicht auf den Takt warten.
    const recheck = () => {
      if (active && !document.hidden) void poll()
    }
    window.addEventListener('online', recheck)
    document.addEventListener('visibilitychange', recheck)

    void start()

    return () => {
      active = false
      stopAll()
      window.removeEventListener('online', recheck)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [session])

  return { score, status, accept, reconnect }
}
