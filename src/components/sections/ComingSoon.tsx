'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Lock, Hourglass, ArrowLeft } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'

interface ComingSoonProps {
  title: string
  enabled: boolean
  revealAt: string | null
}

function useCountdownTo(target: string | null) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!target || now === null) return null
  const diff = new Date(target).getTime() - now
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    isPast: false,
  }
}

export default function ComingSoon({ title, enabled, revealAt }: ComingSoonProps) {
  const countdown = useCountdownTo(enabled ? revealAt : null)
  // A revealAt in the future is why the server chose to render this fallback at all,
  // so treat it as "scheduled" immediately instead of waiting for the first client tick
  // (avoids a flash of the wrong "nicht verfügbar" message before hydration).
  const isScheduled = enabled && Boolean(revealAt) && !countdown?.isPast
  const justUnlocked = enabled && Boolean(revealAt) && countdown?.isPast === true

  return (
    <div className="min-h-screen bg-gradient-to-b from-champagne-light/20 to-white pt-24 pb-16 flex items-center">
      <div className="max-w-lg mx-auto px-4 sm:px-6 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SectionTitle title={title} />

          <Card padding="lg" className="text-center">
            <div className="w-16 h-16 bg-champagne rounded-full flex items-center justify-center mx-auto mb-6">
              {isScheduled ? (
                <Hourglass size={26} className="text-gold" />
              ) : (
                <Lock size={26} className="text-dark-blue" />
              )}
            </div>

            {isScheduled ? (
              <>
                <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-6">
                  Dieser Bereich wird bald freigeschaltet. Schaut später noch einmal vorbei!
                </p>
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-2">
                  {[
                    { value: countdown?.days ?? 0, label: 'Tage' },
                    { value: countdown?.hours ?? 0, label: 'Std' },
                    { value: countdown?.minutes ?? 0, label: 'Min' },
                    { value: countdown?.seconds ?? 0, label: 'Sek' },
                  ].map((unit) => (
                    <div key={unit.label} className="flex flex-col items-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-champagne-light rounded-xl flex items-center justify-center border border-champagne-dark/20">
                        <span className="font-serif text-xl sm:text-2xl font-semibold text-dark-blue tabular-nums">
                          {String(unit.value).padStart(2, '0')}
                        </span>
                      </div>
                      <span className="mt-2 text-[11px] text-gray-500 uppercase tracking-wider">
                        {unit.label}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : justUnlocked ? (
              <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-2">
                Dieser Bereich wurde gerade freigeschaltet! Bitte lade die Seite neu.
              </p>
            ) : (
              <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-2">
                Dieser Bereich ist aktuell nicht verfügbar. Schaut später noch einmal vorbei!
              </p>
            )}

            <div className="mt-8">
              <Link href="/">
                <Button variant="secondary" size="md">
                  <ArrowLeft size={16} />
                  Zurück zur Startseite
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
