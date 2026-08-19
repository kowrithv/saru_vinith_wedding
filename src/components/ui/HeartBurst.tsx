'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart } from 'lucide-react'

interface HeartBurstProps {
  /** Increment this number (e.g. via setState(n => n + 1)) to fire a new burst. */
  trigger: number
  count?: number
}

interface BurstHeart {
  id: number
  left: number
  delay: number
  duration: number
  size: number
  rotate: number
}

export default function HeartBurst({ trigger, count = 24 }: HeartBurstProps) {
  const [hearts, setHearts] = useState<BurstHeart[]>([])

  useEffect(() => {
    if (trigger === 0) return

    const next: BurstHeart[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.8 + Math.random() * 1.2,
      size: 14 + Math.random() * 14,
      rotate: Math.random() * 60 - 30,
    }))
    setHearts(next)

    const timeout = setTimeout(() => setHearts([]), 3200)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <AnimatePresence>
        {hearts.map((heart) => (
          <motion.div
            key={heart.id}
            initial={{ y: '100vh', opacity: 0, rotate: 0 }}
            animate={{ y: '-10vh', opacity: [0, 1, 1, 0], rotate: heart.rotate }}
            exit={{ opacity: 0 }}
            transition={{ duration: heart.duration, delay: heart.delay, ease: 'easeOut' }}
            style={{ position: 'absolute', left: `${heart.left}%` }}
          >
            <Heart size={heart.size} className="text-gold fill-gold drop-shadow" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
