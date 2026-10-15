'use client'

import { useEffect, useState } from 'react'
import { Copy, Eye, EyeOff, Lock, Vote } from 'lucide-react'
import { cn } from '@/lib/utils'

type Phase = 'voting' | 'closed' | 'released'

interface ResultsState {
  phase: Phase
  key: string
}

const LOAD_FAILED = 'Der Stand konnte nicht geladen werden.'
const SWITCH_FAILED = 'Umschalten fehlgeschlagen. Bitte versuch es erneut.'

const PHASES: { phase: Phase; label: string; description: string }[] = [
  { phase: 'voting', label: 'Abstimmen', description: 'Die Gäste stimmen ab. Die Ergebnisse sind verborgen.' },
  {
    phase: 'closed',
    label: 'Beendet',
    description: 'Die Abstimmung ist beendet. Die Ergebnisse sind für die Gäste noch verborgen.',
  },
  { phase: 'released', label: 'Freigegeben', description: 'Die Ergebnisse sind für alle Gäste sichtbar.' },
]

const PHASE_ICONS = { voting: Vote, closed: Lock, released: Eye } as const

// "Wer von uns?": die Abstimmung läuft in drei Schritten. Abstimmen, dann
// Beendet (keine Stimmen mehr, Ergebnisse weiter verborgen), dann Freigegeben
// (die Gäste sehen die Ergebnisse). Der DJ sieht die Ergebnisse immer; sein Link
// steht hier ganz.
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

  const changePhase = async (phase: Phase) => {
    if (!state || phase === state.phase || busy) return
    if (
      phase === 'released' &&
      !window.confirm('Die Auflösung jetzt für alle Gäste freigeben? Alle sehen dann die Ergebnisse.')
    ) {
      return
    }
    setError(null)
    setBusy(true)
    try {
      const response = await fetch('/api/admin/who-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase }),
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

  const current = PHASES.find((entry) => entry.phase === state?.phase)
  const Icon = state ? PHASE_ICONS[state.phase] : EyeOff

  // Die Adresse zum Abtippen ohne "https://", dazu der ganze Link zum Kopieren.
  const address = state ? `${window.location.host}/dj` : ''
  const link = state ? `${window.location.origin}/dj#k=${state.key}` : ''

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopyMessage('Link kopiert.')
    } catch {
      setCopyMessage('Kopieren hat nicht geklappt. Den Link markieren und kopieren oder Adresse und Wort abtippen.')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Icon size={20} className={state?.phase === 'released' ? 'text-green-700' : 'text-gray-400'} aria-hidden="true" />
        <div>
          <p className="font-semibold text-dark-blue text-sm">Wer von uns?</p>
          <p className="text-xs text-gray-400" data-testid="who-phase-description">
            {state === null ? 'Wird geladen …' : current?.description}
          </p>
        </div>
      </div>

      <div
        className="flex rounded-full border border-gray-200 overflow-hidden"
        role="group"
        aria-label="Stand der Abstimmung"
      >
        {PHASES.map((entry, position) => (
          <button
            key={entry.phase}
            type="button"
            onClick={() => changePhase(entry.phase)}
            disabled={state === null || busy}
            aria-pressed={state?.phase === entry.phase}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60',
              position > 0 && 'border-l border-gray-200',
              state?.phase === entry.phase ? 'bg-dark-blue text-white' : 'bg-white text-gray-600 hover:bg-champagne/40'
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {state && (
        <div className="mt-5 rounded-xl bg-champagne-light/60 border border-champagne-dark/40 p-4">
          <p className="text-xs font-medium text-gray-600 mb-3">
            Für den DJ: zeigt die Ergebnisse immer live, in jedem Stand
          </p>
          <label htmlFor="who-dj-link" className="block text-xs text-gray-500 mb-1.5">
            Link
          </label>
          <div className="flex gap-2">
            <input
              id="who-dj-link"
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-700"
            />
            <button
              type="button"
              onClick={copyLink}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-dark-blue hover:bg-champagne/40"
            >
              <Copy size={14} aria-hidden="true" />
              Link kopieren
            </button>
          </div>
          {copyMessage && (
            <p className="mt-2 text-xs text-gray-600" role="status">
              {copyMessage}
            </p>
          )}
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-baseline">
            <dt className="text-xs text-gray-500">Zum Abtippen: Adresse</dt>
            <dd className="font-mono text-sm text-dark-blue break-all" data-testid="dj-address">
              {address}
            </dd>
            <dt className="text-xs text-gray-500">und Wort</dt>
            <dd className="font-mono text-xl font-semibold text-dark-blue" data-testid="dj-word">
              {state.key}
            </dd>
          </dl>
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
