'use client'

import { useSyncExternalStore } from 'react'
import { Clock } from 'lucide-react'
import Button from '@/components/ui/Button'
import { calculateTimeUntil } from '@/lib/utils'
import { receptionEvent } from '@/lib/event-info'

const EVENT_START_MS = Date.parse(receptionEvent.startsAt)

// Der Takt ist feiner als eine Sekunde: der Schnappschuss (ganze Sekunden)
// ändert sich nur einmal pro Sekunde, React rendert also auch nur dann neu.
// Ein reines 1000-ms-Intervall würde gegenüber dem Sekundenwechsel driften
// und gelegentlich eine Sekunde überspringen.
const TICK_MS = 250

function subscribeToClock(onChange: () => void) {
  const id = setInterval(() => {
    onChange()
    // Ab Beginn des Empfangs ändert sich nichts mehr - Timer beenden.
    if (Date.now() >= EVENT_START_MS) clearInterval(id)
  }, TICK_MS)
  return () => clearInterval(id)
}

function getNowSecond(): number {
  return Math.floor(Date.now() / 1000)
}

// Beim Server-Rendering und beim Hydrieren ist die Uhrzeit unbekannt (null):
// beide Seiten rendern das Skelett, es gibt keinen Hydration-Mismatch.
// Bei clientseitiger Navigation entfällt die Hydration, der erste Render
// zeigt sofort die echten Werte statt eines kurzen "00".
function getServerNowSecond(): null {
  return null
}

interface CountdownUnitProps {
  value: number
  label: string
  delay?: number
}

function CountdownUnit({ value, label, delay = 0 }: CountdownUnitProps) {
  const displayValue = String(value).padStart(2, '0')

  return (
    <div
      className="flex flex-col items-center animate-fade-up motion-reduce:animate-none"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* 4 x w-16 + 3 x gap-2 = 280 px: passt auch auf ein 320-px-Handy. */}
      <div className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-white rounded-2xl shadow-md border border-champagne-dark/20 flex items-center justify-center">
        <span className="font-serif text-2xl sm:text-4xl md:text-5xl font-semibold text-dark-blue tabular-nums">
          {displayValue}
        </span>
      </div>
      <span className="mt-3 text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide sm:tracking-wider">
        {label}
      </span>
    </div>
  )
}

function Separator() {
  return (
    <div
      data-testid="countdown-separator"
      className="hidden sm:flex flex-col items-center gap-1.5 mb-7 opacity-40"
    >
      <div className="w-1 h-1 bg-dark-blue rounded-full" />
      <div className="w-1 h-1 bg-dark-blue rounded-full" />
    </div>
  )
}

export default function Countdown() {
  const nowSecond = useSyncExternalStore(subscribeToClock, getNowSecond, getServerNowSecond)
  const timeLeft = nowSecond === null ? null : calculateTimeUntil(receptionEvent.startsAt, nowSecond * 1000)
  const isPast = timeLeft?.isPast ?? false

  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-white to-champagne-light/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {!isPast && (
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 text-gold-text text-sm font-medium mb-3">
              <Clock size={16} />
              <span>Noch so lange bis zum großen Tag</span>
            </div>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold text-dark-blue">Countdown zum Empfang</h2>
            <p className="mt-2 text-gray-600 text-sm">
              {receptionEvent.displayDate} um {receptionEvent.time} (deutscher Zeit)
            </p>
          </div>
        )}

        {timeLeft === null ? (
          <div className="h-28 sm:h-36 md:h-40 motion-safe:animate-pulse bg-champagne/30 rounded-2xl" />
        ) : timeLeft.isPast ? (
          <div className="py-4">
            <h2 className="font-serif text-3xl md:text-4xl text-dark-blue font-semibold">Wir sind verheiratet! 🎉</h2>
            <p className="mt-4 text-gray-600">
              Danke, dass ihr mit uns gefeiert habt – teilt eure Fotos und eure Wünsche mit uns.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button href="/gallery" variant="primary" size="lg">
                Fotos hochladen
              </Button>
              <Button href="/guestbook" variant="secondary" size="lg">
                Ins Gästebuch schreiben
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 sm:gap-6 md:gap-8">
            <CountdownUnit value={timeLeft.days} label="Tage" delay={0} />
            <Separator />
            <CountdownUnit value={timeLeft.hours} label="Stunden" delay={0.1} />
            <Separator />
            <CountdownUnit value={timeLeft.minutes} label="Minuten" delay={0.2} />
            <Separator />
            <CountdownUnit value={timeLeft.seconds} label="Sekunden" delay={0.3} />
          </div>
        )}

        <p className="mt-10 text-xs text-gray-600 font-medium tracking-wide">
          {receptionEvent.venue} · {receptionEvent.address}
        </p>
      </div>
    </section>
  )
}
