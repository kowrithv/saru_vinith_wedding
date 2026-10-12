'use client'

import { motion } from 'framer-motion'
import { Calendar, ChevronDown, Heart } from 'lucide-react'
import Button from '@/components/ui/Button'
import { couple } from '@/lib/site-content'
import { receptionEvent } from '@/lib/event-info'

function FloralOrnament({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M100 60 L120 100 L100 140 L80 100 Z" fill="currentColor" opacity="0.4" />
      <path d="M100 75 L113 100 L100 125 L87 100 Z" fill="currentColor" opacity="0.6" />
      <path d="M100 20 C90 40 88 55 100 60 C112 55 110 40 100 20Z" fill="currentColor" opacity="0.3" />
      <path d="M100 180 C90 160 88 145 100 140 C112 145 110 160 100 180Z" fill="currentColor" opacity="0.3" />
      <path d="M20 100 C40 90 55 88 60 100 C55 112 40 110 20 100Z" fill="currentColor" opacity="0.3" />
      <path d="M180 100 C160 90 145 88 140 100 C145 112 160 110 180 100Z" fill="currentColor" opacity="0.3" />
      <circle cx="100" cy="100" r="4" fill="currentColor" opacity="0.8" />
    </svg>
  )
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const } },
}

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-champagne-light via-white to-baby-blue-light">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloralOrnament className="absolute -top-20 -left-20 w-80 h-80 text-champagne-dark opacity-30" />
        <FloralOrnament className="absolute -bottom-20 -right-20 w-96 h-96 text-baby-blue-dark opacity-25" />
        <FloralOrnament className="absolute top-1/2 -translate-y-1/2 -right-16 w-64 h-64 text-gold opacity-10" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col items-center">
          <motion.div variants={itemVariants} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/70 backdrop-blur-sm text-dark-blue text-sm font-medium rounded-full border border-champagne-dark/30 shadow-sm">
              <Heart size={12} className="text-gold fill-gold" />
              Wir heiraten!
              <Heart size={12} className="text-gold fill-gold" />
            </span>
          </motion.div>

          <motion.div variants={itemVariants} className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/50" />
            <FloralOrnament className="w-10 h-10 text-gold" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/50" />
          </motion.div>

          <motion.h1 variants={itemVariants} className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-dark-blue leading-tight mb-2">
            {couple.bride}
          </motion.h1>

          <motion.div variants={itemVariants} className="flex items-center justify-center gap-4 my-2">
            <div className="h-px w-20 bg-gold/40" />
            <span className="text-2xl text-gold font-serif">&amp;</span>
            <div className="h-px w-20 bg-gold/40" />
          </motion.div>

          <motion.h1 variants={itemVariants} className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-dark-blue leading-tight mb-6">
            {couple.groom}
          </motion.h1>

          <motion.p variants={itemVariants} className="text-gold font-medium text-lg mb-8">
            {couple.hashtag}
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm border border-champagne-dark/30 rounded-2xl px-6 py-4 shadow-sm">
              <div className="w-10 h-10 bg-dark-blue rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar size={18} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Empfang</p>
                <p className="text-dark-blue font-semibold text-sm">{receptionEvent.displayDate}</p>
                <p className="text-xs text-gray-500">{receptionEvent.time} · {receptionEvent.venue}</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
            <Button href="/info" variant="primary" size="lg">
              Hochzeitsinfos
            </Button>
            <Button href="/story" variant="secondary" size="lg">
              Unsere Geschichte
            </Button>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-8 inset-x-0 flex flex-col items-center gap-2 text-dark-blue/50"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.6 }}
      >
        <span className="text-xs font-medium tracking-widest uppercase">Mehr entdecken</span>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}>
          <ChevronDown size={20} />
        </motion.div>
      </motion.div>
    </section>
  )
}
