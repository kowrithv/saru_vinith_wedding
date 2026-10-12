'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { calculateTimeUntil } from '@/lib/utils'
import { receptionEvent } from '@/lib/event-info'

function subscribeNoop() {
  return () => {}
}

// Liefert false beim Server-Rendering und beim allerersten Client-Render
// (identisch, damit Hydration nicht mismatcht), erst danach true - der
// dafür vorgesehene React-Mechanismus statt setState in einem Effekt.
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
}

interface CountdownUnitProps {
  value: number
  label: string
  delay?: number
}

function CountdownUnit({ value, label, delay = 0 }: CountdownUnitProps) {
  const displayValue = String(value).padStart(2, '0')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="flex flex-col items-center"
    >
      <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-white rounded-2xl shadow-md border border-champagne-dark/20 flex items-center justify-center">
        <span className="font-serif text-3xl sm:text-4xl md:text-5xl font-semibold text-dark-blue tabular-nums">
          {displayValue}
        </span>
      </div>
      <span className="mt-3 text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">{label}</span>
    </motion.div>
  )
}

function Separator() {
  return (
    <div className="flex flex-col items-center gap-1.5 mb-7 opacity-40">
      <div className="w-1 h-1 bg-dark-blue rounded-full" />
      <div className="w-1 h-1 bg-dark-blue rounded-full" />
    </div>
  )
}

export default function Countdown() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false })
  const mounted = useHydrated()

  useEffect(() => {
    const update = () => {
      setTimeLeft(calculateTimeUntil(receptionEvent.date, receptionEvent.rawTime))
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-white to-champagne-light/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 text-gold text-sm font-medium mb-3">
            <Clock size={16} />
            <span>Noch so lange bis zum großen Tag</span>
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-semibold text-dark-blue">Countdown zum Empfang</h2>
          <p className="mt-2 text-gray-500 text-sm">
            {receptionEvent.displayDate} um {receptionEvent.time}
          </p>
        </div>

        {!mounted ? (
          <div className="h-40 animate-pulse bg-champagne/30 rounded-2xl" />
        ) : timeLeft.isPast ? (
          <div className="py-12">
            <p className="font-serif text-4xl text-dark-blue font-semibold">Wir sind verheiratet! 🎉</p>
            <p className="mt-4 text-gray-600">{receptionEvent.displayDate} – Ein Tag, den wir nie vergessen werden</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 sm:gap-6 md:gap-8">
            <CountdownUnit value={timeLeft.days} label="Tage" delay={0} />
            <Separator />
            <CountdownUnit value={timeLeft.hours} label="Stunden" delay={0.1} />
            <Separator />
            <CountdownUnit value={timeLeft.minutes} label="Minuten" delay={0.2} />
            <Separator />
            <CountdownUnit value={timeLeft.seconds} label="Sekunden" delay={0.3} />
          </div>
        )}

        <p className="mt-10 text-xs text-gray-400 font-medium tracking-wide">
          {receptionEvent.venue} · {receptionEvent.address}
        </p>
      </div>
    </section>
  )
}
