'use client'

import type { CSSProperties } from 'react'
import { Crown, Flower2, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { couple } from '@/lib/site-content'
import { polaroidCaption } from '@/lib/event-info'
import type { ScoreSnapshot } from '@/lib/score'
import type { ScoreStatus } from '@/lib/use-live-score'
import { useScoreBumps, type ScoreBump } from '@/lib/use-score-bumps'
import { SCORE_CSS_VARS } from '@/lib/score-colors'

// Alle Maße sind in cqmin: 1 % der kürzeren Seite des Bildschirms. Die Anzeige wächst und
// schrumpft damit mit jedem Beamer und jedem Fenster, ohne dass etwas umbricht oder
// abgeschnitten wird. Hochkant (Handy-Vorschau) stehen die Teams untereinander.
// Teamfarben und Hintergrund kommen aus score-colors.ts (gleich wie auf der Steuer-Seite).
const THEME = {
  ...SCORE_CSS_VARS,
  '--card': '#fbf9f4',
  '--ink': '#1c1c1c',
} as CSSProperties

const STATUS_LABEL: Record<ScoreStatus, string> = {
  live: 'Live verbunden',
  polling: 'Verbindung wird neu aufgebaut',
  connecting: 'Verbindung wird aufgebaut',
  login: 'Nicht angemeldet',
}

const STATUS_DOT: Record<ScoreStatus, string> = {
  live: 'bg-emerald-500/70',
  polling: 'bg-amber-500',
  connecting: 'bg-gray-400',
  login: 'bg-gray-400',
}

function digitsClass(value: number | null): string {
  const length = value === null ? 1 : String(value).length
  if (length >= 3) return 'text-[18cqmin]'
  if (length === 2) return 'text-[27cqmin]'
  return 'text-[30cqmin]'
}

function BowTie({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" aria-hidden="true" className={className} fill="currentColor">
      <path d="M32 16 6 3c-2-1-4 0-4 2v22c0 2 2 3 4 2l26-13Z" />
      <path d="m32 16 26-13c2-1 4 0 4 2v22c0 2-2 3-4 2L32 16Z" />
      <rect x="27" y="9" width="10" height="14" rx="3" />
    </svg>
  )
}

interface TeamProps {
  label: 'Bride' | 'Groom'
  value: number | null
  bump: ScoreBump | null
  accent: string
  tape: string
  tilt: string
  decoration: 'bride' | 'groom'
}

function Team({ label, value, bump, accent, tape, tilt, decoration }: TeamProps) {
  const shown = value === null ? '–' : String(value)
  return (
    <section
      aria-label={`Team ${label}`}
      className="relative grid min-h-0 w-[min(100%,56cqmin)] flex-1 grid-rows-[24fr_42fr] gap-[3.5cqmin] portrait:w-full"
    >
      {/* Schild "Team …": wie ein Polaroid mit Klebestreifen */}
      <div className={cn('relative min-h-0 w-[82%] justify-self-center bg-[var(--card)] p-[1.6cqmin] shadow-[0_0.8cqmin_2.4cqmin_rgba(60,45,30,0.16)] portrait:w-[92%]', tilt)}>
        <span
          aria-hidden="true"
          className={cn('absolute -top-[2.4cqmin] left-1/2 h-[4.6cqmin] w-[16cqmin] -translate-x-1/2 -rotate-1 opacity-85', tape)}
        />
        <div className="relative flex h-full flex-col items-center justify-center bg-[#f0ebe0] shadow-[inset_0_0_2cqmin_rgba(120,100,70,0.12)]">
          <p className="font-display text-[3.6cqmin] font-semibold uppercase leading-none tracking-[0.4em] pl-[0.4em]">Team</p>
          <p className={cn('mt-[1.2cqmin] font-script text-[12.5cqmin] leading-[1.15]', accent)}>{label}</p>
          {decoration === 'bride' ? (
            <>
              <Crown aria-hidden="true" className="absolute right-[3cqmin] top-[2.4cqmin] h-[5.4cqmin] w-[5.4cqmin]" strokeWidth={1.4} />
              <Flower2 aria-hidden="true" className="absolute bottom-[2cqmin] right-[3cqmin] h-[6cqmin] w-[6cqmin]" strokeWidth={1.2} />
              <Heart aria-hidden="true" className="absolute left-[3cqmin] top-1/2 h-[4.2cqmin] w-[4.2cqmin] -translate-y-1/2" strokeWidth={1.4} />
            </>
          ) : (
            <>
              <BowTie className="absolute right-[3cqmin] top-[2.6cqmin] h-[4.4cqmin] w-[8.8cqmin] text-[var(--groom)]" />
              <Heart aria-hidden="true" className="absolute left-[3cqmin] top-1/2 h-[4.2cqmin] w-[4.2cqmin] -translate-y-1/2" strokeWidth={1.4} />
            </>
          )}
        </div>
      </div>

      {/* Kasten "Score" mit der Zahl */}
      <div className="flex min-h-0 flex-col bg-[var(--card)] p-[2cqmin] pb-[1.4cqmin] shadow-[0_0.8cqmin_2.4cqmin_rgba(60,45,30,0.16)]">
        <div className="flex min-h-0 flex-1 items-center justify-center border-[0.35cqmin] border-[var(--ink)]">
          <span
            key={shown}
            role="img"
            aria-label={`Punkte Team ${label}: ${value === null ? 'noch unbekannt' : value}`}
            className={cn(
              'animate-score-pop motion-reduce:animate-none font-serif font-semibold leading-none [font-variant-numeric:lining-nums_tabular-nums]',
              digitsClass(value),
              accent
            )}
          >
            {shown}
          </span>
        </div>
        <p className="flex items-center justify-center gap-[2.4cqmin] pt-[1.4cqmin] font-display text-[3cqmin] font-semibold uppercase leading-none tracking-[0.4em]">
          <Heart aria-hidden="true" className="h-[3.2cqmin] w-[3.2cqmin]" strokeWidth={1.4} />
          <span aria-hidden="true" className="block h-px w-[5cqmin] bg-[var(--ink)]" />
          <span className="pl-[0.4em]">Score</span>
          <span aria-hidden="true" className="block h-px w-[5cqmin] bg-[var(--ink)]" />
          <Heart aria-hidden="true" className="h-[3.2cqmin] w-[3.2cqmin]" strokeWidth={1.4} />
        </p>
      </div>

      {/* Schwebendes "+1": der neue Schlüssel startet die Animation bei jedem Punkt von vorn. Der Stand
          selbst wird über die Zahl angesagt, deshalb für Screenreader versteckt. */}
      {bump && (
        <span
          key={bump.id}
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-[76%] top-[58%] z-10 font-serif text-[16cqmin] font-bold leading-none animate-score-plus motion-reduce:animate-score-plus-still [text-shadow:0_0_1.2cqmin_var(--card),0_0_0.4cqmin_var(--card)]',
            accent
          )}
        >
          +{bump.delta}
        </span>
      )}
    </section>
  )
}

interface ScoreBoardProps {
  score: ScoreSnapshot | null
  status: ScoreStatus
}

/** Die Beamer-Anzeige: Team Bride gegen Team Groom, bildschirmfüllend und nur zum Ansehen. */
export default function ScoreBoard({ score, status }: ScoreBoardProps) {
  const bumps = useScoreBumps(score)
  return (
    <main
      style={THEME}
      className="fixed inset-0 z-[100] cursor-none select-none overflow-hidden bg-[radial-gradient(ellipse_at_center,var(--backdrop-center)_0%,var(--backdrop-edge)_100%)] text-[var(--ink)] [container-type:size]"
    >
      <div className="flex h-full w-full flex-col items-center px-[4cqmin] py-[2.6cqmin]">
        <header className="flex shrink-0 flex-col items-center">
          <p className="mb-[1.4cqmin] font-display text-[2.3cqmin] font-semibold uppercase leading-none tracking-[0.42em] pl-[0.42em] portrait:text-[3cqmin]">
            {polaroidCaption.occasion}
          </p>
          <div className="relative flex items-center gap-[6cqmin] portrait:gap-[3cqmin]">
            <Heart aria-hidden="true" className="h-[5cqmin] w-[5cqmin] -rotate-6 portrait:h-[4cqmin] portrait:w-[4cqmin]" strokeWidth={1.4} />
            <h1 className="whitespace-nowrap font-script text-[11.5cqmin] leading-[1.2] portrait:text-[11.5cqmin]">{couple.combinedName}</h1>
            <Heart aria-hidden="true" className="h-[5cqmin] w-[5cqmin] rotate-6 portrait:h-[4cqmin] portrait:w-[4cqmin]" strokeWidth={1.4} />
          </div>
          <p className="font-display text-[2.5cqmin] font-semibold leading-none tracking-[0.4em] pl-[0.4em] [font-variant-numeric:lining-nums] portrait:text-[3cqmin]">
            {polaroidCaption.date}
          </p>
        </header>

        <div className="mt-[4.5cqmin] flex min-h-0 w-full flex-1 items-stretch justify-center gap-[2.5cqmin] portrait:flex-col">
          <Team
            label="Bride"
            value={score?.bride ?? null}
            bump={bumps.bride}
            accent="text-[var(--bride)]"
            tape="bg-[var(--bride-tape)]"
            tilt="-rotate-[2.2deg]"
            decoration="bride"
          />

          <div aria-hidden="true" className="flex shrink-0 flex-col items-center py-[1cqmin] portrait:flex-row portrait:px-[1cqmin] portrait:py-0">
            <span className="w-px flex-1 bg-[var(--ink)] portrait:h-px portrait:w-auto" />
            <span className="px-0 py-[2cqmin] font-script text-[7cqmin] leading-none portrait:px-[3cqmin] portrait:py-0">vs</span>
            <Heart className="my-[1.5cqmin] h-[4cqmin] w-[4cqmin]" strokeWidth={1.4} />
            <span className="w-px flex-1 bg-[var(--ink)] portrait:h-px portrait:w-auto" />
          </div>

          <Team
            label="Groom"
            value={score?.groom ?? null}
            bump={bumps.groom}
            accent="text-[var(--groom)]"
            tape="bg-[var(--groom-tape)]"
            tilt="rotate-[2.2deg]"
            decoration="groom"
          />
        </div>
      </div>

      {/* Verbindungsanzeige: so klein, dass sie nicht stört, aber der Bediener sieht, ob es live ist. */}
      <span
        role="status"
        aria-label={STATUS_LABEL[status]}
        title={STATUS_LABEL[status]}
        className={cn('absolute bottom-[1.2cqmin] left-[1.2cqmin] h-[1.1cqmin] w-[1.1cqmin] rounded-full', STATUS_DOT[status])}
      />
    </main>
  )
}
