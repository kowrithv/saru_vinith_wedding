'use client'

import Link from 'next/link'
import { CalendarPlus, Camera, CalendarDays, MessageSquare, Heart } from 'lucide-react'
import Lotus from '@/components/ui/Lotus'
import { calculateTimeUntil } from '@/lib/utils'
import { receptionEvent } from '@/lib/event-info'
import { eventPhase, type EventPhase } from '@/lib/event-phase'
import { downloadEventIcs } from '@/lib/calendar'
import { useNowSecond } from '@/lib/use-now-second'
import { cn } from '@/lib/utils'

const EVENT_START_MS = Date.parse(receptionEvent.startsAt)

const pad = (value: number) => String(value).padStart(2, '0')

interface UnitProps {
  value: number
  label: string
  large?: boolean
}

function Unit({ value, label, large = false }: UnitProps) {
  return (
    <div className="flex flex-col items-center">
      <b
        className={cn(
          'font-display font-semibold leading-none tabular-nums lining-nums',
          large ? 'text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl'
        )}
      >
        {pad(value)}
      </b>
      <span className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-white/75">{label}</span>
    </div>
  )
}

interface ActionLinkProps {
  href: string
  icon: typeof Camera
  children: string
  primary?: boolean
}

function ActionLink({ href, icon: Icon, children, primary = false }: ActionLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 text-left font-semibold transition-colors',
        primary
          ? 'bg-bordeaux text-white hover:bg-bordeaux-light'
          : 'border border-champagne-dark/60 bg-champagne-light text-dark-blue hover:bg-champagne'
      )}
    >
      <Icon size={20} className="flex-shrink-0" />
      <span>{children}</span>
    </Link>
  )
}

// Am Hochzeitstag und danach stehen die Wege nach vorn, die Gäste dann brauchen.
function DayActions({ phase }: { phase: EventPhase }) {
  if (phase === 'after') {
    return (
      <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
        <ActionLink href="/gallery" icon={Camera} primary>
          Fotos ansehen
        </ActionLink>
        <ActionLink href="/memories" icon={Heart}>
          Erinnerung teilen
        </ActionLink>
        <ActionLink href="/guestbook" icon={MessageSquare}>
          Ins Gästebuch schreiben
        </ActionLink>
      </div>
    )
  }
  return (
    <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
      <ActionLink href="/gallery" icon={Camera} primary>
        Fotos hochladen
      </ActionLink>
      <ActionLink href="/info" icon={CalendarDays}>
        Ablauf des Tages
      </ActionLink>
      <ActionLink href="/guestbook" icon={MessageSquare}>
        Ins Gästebuch schreiben
      </ActionLink>
    </div>
  )
}

export default function Countdown() {
  const nowSecond = useNowSecond(EVENT_START_MS)
  const nowMs = nowSecond === null ? null : nowSecond * 1000
  const timeLeft = nowMs === null ? null : calculateTimeUntil(receptionEvent.startsAt, nowMs)
  const isPast = timeLeft?.isPast ?? false
  const phase: EventPhase = nowMs === null ? 'before' : eventPhase(nowMs)

  return (
    <section id="countdown" className="bg-dark-blue py-16 text-white md:py-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center sm:px-6">
        {timeLeft === null ? (
          <div className="h-48 w-full max-w-md rounded-2xl bg-white/10 motion-safe:animate-pulse" />
        ) : isPast || phase === 'after' ? (
          <>
            <Lotus size={44} className="text-gold" />
            <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">Wir sind verheiratet!</h2>
            <p className="mt-3 max-w-md text-champagne-light/90">
              {phase === 'after'
                ? 'Danke, dass ihr mit uns gefeiert habt. Schaut euch die Fotos an und lasst uns eure Erinnerungen und Wünsche da.'
                : 'Danke, dass ihr mit uns feiert. Teilt eure Fotos und eure Wünsche mit uns.'}
            </p>
            <DayActions phase={phase} />
          </>
        ) : phase === 'today' ? (
          <>
            <Lotus size={44} className="text-gold" />
            <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">Heute ist es so weit</h2>
            <p className="mt-2 text-champagne-light/90">Noch bis zum Empfang um {receptionEvent.time}</p>
            <div data-testid="countdown-small" className="mt-6 flex flex-wrap items-end justify-center gap-x-8 gap-y-4">
              <Unit value={timeLeft.hours} label="Stunden" large />
              <Unit value={timeLeft.minutes} label="Minuten" large />
              <Unit value={timeLeft.seconds} label="Sekunden" large />
            </div>
            <DayActions phase={phase} />
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Noch</p>
            <p className="mt-2 font-display text-7xl font-semibold leading-none tabular-nums lining-nums text-gold sm:text-8xl">
              {pad(timeLeft.days)}
            </p>
            <p className="mt-3 font-display text-2xl">
              <span>{timeLeft.days === 1 ? 'Tag' : 'Tage'}</span> bis zu unserem Empfang
            </p>
            <div data-testid="countdown-small" className="mt-6 flex flex-wrap items-end justify-center gap-x-8 gap-y-4">
              <Unit value={timeLeft.hours} label="Stunden" />
              <Unit value={timeLeft.minutes} label="Minuten" />
              <Unit value={timeLeft.seconds} label="Sekunden" />
            </div>
            <div className="mt-6 flex items-center gap-3 text-gold" aria-hidden="true">
              <span className="h-px w-12 bg-gold/50" />
              <Lotus size={18} />
              <span className="h-px w-12 bg-gold/50" />
            </div>
            <p className="mt-4 text-sm text-champagne-light/90">
              {receptionEvent.displayDate} um {receptionEvent.time} (deutscher Zeit)
            </p>
            <button
              type="button"
              onClick={downloadEventIcs}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-dark-blue-dark transition-colors hover:bg-gold-light"
            >
              <CalendarPlus size={16} />
              In meinen Kalender
            </button>
          </>
        )}

        <p className="mt-10 text-xs font-medium tracking-wide text-champagne-light/80">
          <span className="inline-block">{receptionEvent.venue}</span>
          <span aria-hidden="true"> · </span>
          <span className="inline-block">{receptionEvent.address}</span>
        </p>
      </div>
    </section>
  )
}
