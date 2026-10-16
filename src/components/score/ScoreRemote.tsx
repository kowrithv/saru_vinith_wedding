'use client'

import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { polaroidCaption } from '@/lib/event-info'
import type { ScoreTeam } from '@/lib/score'
import { parseScore, useLiveScore, type ScoreStatus } from '@/lib/use-live-score'
import ScoreLoading from './ScoreLoading'
import ScoreLoginForm from './ScoreLoginForm'
import ScoreScreen from './ScoreScreen'
import { SCORE_CSS_VARS } from '@/lib/score-colors'

const STATUS_TEXT: Record<ScoreStatus, string> = {
  live: 'Live verbunden',
  polling: 'Verbindung wird neu aufgebaut',
  connecting: 'Verbindung wird aufgebaut',
  login: '',
}

const STATUS_DOT: Record<ScoreStatus, string> = {
  live: 'bg-emerald-500',
  polling: 'bg-amber-500',
  connecting: 'bg-gray-400',
  login: 'bg-gray-400',
}

interface TeamPanelProps {
  team: ScoreTeam
  label: string
  value: number | null
  nameClass: string
  buttonClass: string
  outlineClass: string
  onChange: (team: ScoreTeam, delta: 1 | -1) => void
}

function TeamPanel({ team, label, value, nameClass, buttonClass, outlineClass, onChange }: TeamPanelProps) {
  return (
    <section aria-label={`Team ${label}`} className="flex flex-col rounded-3xl bg-white/80 p-3 text-center shadow-sm ring-1 ring-black/5 sm:p-5">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.35em]">Team</p>
      <p className={cn('font-script text-5xl leading-tight', nameClass)}>{label}</p>
      <p
        role="img"
        aria-label={`Punkte Team ${label}: ${value ?? 'noch unbekannt'}`}
        className={cn('my-2 font-serif text-8xl font-semibold leading-none [font-variant-numeric:lining-nums_tabular-nums]', nameClass)}
      >
        {value ?? '–'}
      </p>
      <button
        type="button"
        aria-label={`Team ${label}: 1 Punkt dazu`}
        onClick={() => onChange(team, 1)}
        className={cn('min-h-24 w-full flex-1 touch-manipulation select-none rounded-2xl text-5xl font-semibold text-white shadow-md transition-transform active:scale-95', buttonClass)}
      >
        +1
      </button>
      <button
        type="button"
        aria-label={`Team ${label}: 1 Punkt weg`}
        onClick={() => onChange(team, -1)}
        className={cn('mt-3 h-14 w-full touch-manipulation select-none rounded-2xl border-2 bg-white text-2xl font-semibold transition-transform active:scale-95', outlineClass)}
      >
        −1
      </button>
    </section>
  )
}

/** Die Steuer-Seite für Handy und Laptop: Punkte vergeben, die Beamer-Anzeige folgt sofort. */
export default function ScoreRemote() {
  const { score, status, accept, reconnect } = useLiveScore()
  const [error, setError] = useState<string | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  // Jedes Tippen schickt "+1" oder "-1" und wartet nicht auf das vorige: bei schnellem Tippen
  // geht nichts verloren, und die Antwort trägt den Stand, den auch der Beamer bekommt.
  const send = useCallback(
    async (payload: { action: 'change'; team: ScoreTeam; delta: 1 | -1 } | { action: 'reset' }) => {
      setError(null)
      try {
        const response = await fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.status === 401) {
          reconnect()
          return
        }
        const next = response.ok ? parseScore(await response.json()) : null
        if (!next) {
          setError('Nicht gespeichert. Bitte noch einmal tippen.')
          return
        }
        accept(next)
      } catch {
        setError('Nicht gespeichert, keine Verbindung. Bitte noch einmal tippen.')
      }
    },
    [accept, reconnect]
  )

  if (status === 'login') {
    return <ScoreLoginForm title="Punktestand steuern" onSuccess={reconnect} />
  }
  // Noch unklar, ob eine Anmeldung gilt: nur der Hintergrund, nicht erst die Knöpfe und dann das Anmeldefenster.
  if (status === 'connecting' && score === null) return <ScoreLoading />

  const change = (team: ScoreTeam, delta: 1 | -1) => void send({ action: 'change', team, delta })

  return (
    <ScoreScreen>
      <main style={SCORE_CSS_VARS} className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 px-3 py-5 sm:px-6">
        <header className="text-center">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.35em]">{polaroidCaption.occasion}</p>
          <h1 className="font-script text-5xl leading-tight">Punktestand</h1>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-gray-700">
            <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', STATUS_DOT[status])} />
            {STATUS_TEXT[status]}
          </p>
        </header>

        <div className="grid flex-1 grid-cols-2 gap-3 sm:gap-5">
          <TeamPanel
            team="bride"
            label="Bride"
            value={score?.bride ?? null}
            nameClass="text-[var(--bride)]"
            buttonClass="bg-[var(--bride)]"
            outlineClass="border-[var(--bride)] text-[var(--bride)]"
            onChange={change}
          />
          <TeamPanel
            team="groom"
            label="Groom"
            value={score?.groom ?? null}
            nameClass="text-[var(--groom)]"
            buttonClass="bg-[var(--groom)]"
            outlineClass="border-[var(--groom)] text-[var(--groom)]"
            onChange={change}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="pt-2 text-center">
          {confirmingReset ? (
            <div role="group" aria-label="Zurücksetzen bestätigen" className="space-y-3">
              <p className="text-sm font-medium">Wirklich beide Teams auf 0 setzen?</p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingReset(false)
                    void send({ action: 'reset' })
                  }}
                  className="h-12 touch-manipulation rounded-xl bg-bordeaux px-5 text-base font-medium text-white"
                >
                  Ja, auf 0 setzen
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="h-12 touch-manipulation rounded-xl border-2 border-gray-300 bg-white px-5 text-base font-medium"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="h-11 touch-manipulation rounded-xl px-4 text-sm font-medium text-gray-600 underline underline-offset-4"
            >
              Auf 0 zurücksetzen
            </button>
          )}
        </div>
      </main>
    </ScoreScreen>
  )
}
