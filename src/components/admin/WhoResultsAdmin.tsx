'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResultsState {
  released: boolean
  key: string
}

const LOAD_FAILED = 'Der Stand konnte nicht geladen werden.'
const SWITCH_FAILED = 'Umschalten fehlgeschlagen. Bitte versuch es erneut.'

// "Wer von uns?": Auflösung für die Gäste freigeben und den Lese-Link für den
// DJ zeigen. Die Ergebnisse bleiben für Gäste verborgen, bis sie freigegeben
// sind; mit der Freigabe endet die Abstimmung.
export default function WhoResultsAdmin() {
  const [state, setState] = useState<ResultsState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const linkRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    fetch('/api/admin/who-results')
      .then((res) => {
        if (!res.ok) throw new Error('Laden fehlgeschlagen')
        return res.json()
      })
      .then((data: ResultsState) => {
        if (active) setState(data)
      })
      .catch(() => {
        if (active) setError(LOAD_FAILED)
      })
    return () => {
      active = false
    }
  }, [])

  const setReleased = async (released: boolean) => {
    if (
      released &&
      !window.confirm('Die Auflösung jetzt für alle Gäste freigeben? Die Abstimmung ist damit beendet.')
    ) {
      return
    }
    setError(null)
    setBusy(true)
    try {
      const response = await fetch('/api/admin/who-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ released }),
      })
      if (!response.ok) {
        setError(response.status === 401 ? 'Sitzung abgelaufen – bitte neu anmelden.' : SWITCH_FAILED)
        return
      }
      setState((await response.json()) as ResultsState)
    } catch {
      setError(SWITCH_FAILED)
    } finally {
      setBusy(false)
    }
  }

  const link = state ? `${window.location.origin}/wer-von-uns/ergebnisse#k=${state.key}` : ''

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Ohne Zwischenablage: den Link markieren, dann lässt er sich kopieren.
      linkRef.current?.select()
    }
  }

  const released = state?.released === true

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {released ? (
            <Eye size={20} className="text-green-700" aria-hidden="true" />
          ) : (
            <EyeOff size={20} className="text-gray-400" aria-hidden="true" />
          )}
          <div>
            <p className="font-semibold text-dark-blue text-sm">Wer von uns? – Auflösung</p>
            <p className="text-xs text-gray-400">
              {state === null
                ? 'Wird geladen …'
                : released
                  ? 'Für Gäste freigegeben. Die Abstimmung ist beendet.'
                  : 'Verborgen. Die Gäste stimmen noch ab.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={released}
          aria-label="Auflösung für Gäste freigeben"
          disabled={state === null || busy}
          onClick={() => setReleased(!released)}
          className={cn(
            'w-12 h-7 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50',
            released ? 'bg-green-600' : 'bg-gray-200'
          )}
        >
          <span
            className={cn(
              'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
              released ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {state && (
        <div className="mt-4">
          <label htmlFor="who-dj-link" className="block text-xs font-medium text-gray-600 mb-1.5">
            Link für den DJ (zeigt die Ergebnisse live, auch vor der Freigabe)
          </label>
          <div className="flex gap-2">
            <input
              id="who-dj-link"
              ref={linkRef}
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
            />
            <button
              type="button"
              onClick={copyLink}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-dark-blue hover:bg-champagne/40"
            >
              <Copy size={14} aria-hidden="true" />
              {copied ? 'Kopiert' : 'Kopieren'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            Nur an den DJ weitergeben. Der Link gilt, bis <code>ADMIN_SECRET</code> geändert wird.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-4" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
