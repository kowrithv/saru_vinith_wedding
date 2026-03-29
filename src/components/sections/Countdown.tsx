'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { calculateTimeUntil } from '@/lib/utils'
import { civilWedding } from '@/lib/config'

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
      <div className="relative">
        <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-white rounded-2xl shadow-md border border-champagne-dark/20 flex items-center justify-center overflow-hidden">
          <motion.span
            key={value}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-semibold text-dark-blue tabular-nums"
          >
            {displayValue}
          </motion.span>
        </div>
        {/* Decorative corner */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-gold rounded-full opacity-60" />
        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-champagne-dark rounded-full opacity-40" />
      </div>
      <span className="mt-3 text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </span>
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
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: false,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const updateCountdown = () => {
      const result = calculateTimeUntil(civilWedding.date, '14:00')
      setTimeLeft(result)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return (
      <section className="py-16 md:py-20 bg-gradient-to-b from-white to-champagne-light/30">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="h-40 animate-pulse bg-champagne/30 rounded-2xl" />
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-white to-champagne-light/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <div className="inline-flex items-center gap-2 text-gold text-sm font-medium mb-3">
            <Clock size={16} />
            <span>Noch so lange bis zum großen Tag</span>
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-semibold text-dark-blue">
            Countdown zur Trauung
          </h2>
          <p className="mt-2 text-gray-500 text-sm">
            {civilWedding.displayDate} um {civilWedding.time}
          </p>
        </motion.div>

        {timeLeft.isPast ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-12"
          >
            <p className="font-serif text-4xl text-dark-blue font-semibold">
              Wir sind verheiratet! 🎉
            </p>
            <p className="mt-4 text-gray-600">
              {civilWedding.displayDate} – Ein Tag, den wir nie vergessen werden
            </p>
          </motion.div>
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

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-10 text-xs text-gray-400 font-medium tracking-wide"
        >
          {civilWedding.venue} · {civilWedding.address}
        </motion.p>
      </div>
    </section>
  )
}
