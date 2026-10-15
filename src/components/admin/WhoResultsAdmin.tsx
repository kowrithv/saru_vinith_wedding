'use client'

import { useEffect, useState } from 'react'
import { Copy, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResultsState {
  released: boolean
  key: string
}

const LOAD_FAILED = 'Der Stand konnte nicht geladen werden.'
const SWITCH_FAILED = 'Umschalten fehlgeschlagen. Bitte versuch es erneut.'

// "Wer von uns?": Auflösung für die Gäste freigeben und den Zugang für den DJ
// zeigen (Adresse und ein Wort zum Abtippen). Die Ergebnisse bleiben für Gäste
// verborgen, bis sie freigegeben sind; mit der Freigabe endet die Abstimmung.
export default function WhoResultsAdmin() {
  const [state, setState] = useState<ResultsState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

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

  // Die Adresse zum Abtippen ohne "https://".
  const address = state ? `${window.location.host}/dj` : ''
  const link = state ? `${window.location.origin}/dj#k=${state.key}` : ''

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopyMessage('Link kopiert.')
    } catch {
      setCopyMessage('Kopieren hat nicht geklappt. Adresse und Wort lassen sich abtippen.')
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
              'absolute left-0 top-1 w-5 h-5 rounded-full bg-white transition-transform',
              released ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {state && (
        <div className="mt-5 rounded-xl bg-champagne-light/60 border border-champagne-dark/40 p-4">
          <p className="text-xs font-medium text-gray-600 mb-3">
            Für den DJ: zeigt die Ergebnisse live, auch vor der Freigabe
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-baseline">
            <dt className="text-xs text-gray-500">Adresse</dt>
            <dd className="font-mono text-sm text-dark-blue break-all" data-testid="dj-address">
              {address}
            </dd>
            <dt className="text-xs text-gray-500">Wort</dt>
            <dd className="font-mono text-xl font-semibold text-dark-blue" data-testid="dj-word">
              {state.key}
            </dd>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-dark-blue hover:bg-champagne/40"
            >
              <Copy size={14} aria-hidden="true" />
              Link kopieren
            </button>
            {copyMessage && (
              <span className="text-xs text-gray-600" role="status">
                {copyMessage}
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Nur an den DJ weitergeben. Das Wort gilt, bis <code>ADMIN_SECRET</code> geändert wird.
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
