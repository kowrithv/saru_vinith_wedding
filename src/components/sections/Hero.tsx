'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Calendar, ChevronDown, Heart } from 'lucide-react'
import Button from '@/components/ui/Button'
import { couple, receptionEvent, traditionalWedding, showTraditionalWeddingTab } from '@/lib/config'

function FloralOrnament({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Center diamond */}
      <path d="M100 60 L120 100 L100 140 L80 100 Z" fill="currentColor" opacity="0.4" />
      {/* Inner diamond */}
      <path d="M100 75 L113 100 L100 125 L87 100 Z" fill="currentColor" opacity="0.6" />
      {/* Top petal */}
      <path d="M100 20 C90 40 88 55 100 60 C112 55 110 40 100 20Z" fill="currentColor" opacity="0.3" />
      {/* Bottom petal */}
      <path d="M100 180 C90 160 88 145 100 140 C112 145 110 160 100 180Z" fill="currentColor" opacity="0.3" />
      {/* Left petal */}
      <path d="M20 100 C40 90 55 88 60 100 C55 112 40 110 20 100Z" fill="currentColor" opacity="0.3" />
      {/* Right petal */}
      <path d="M180 100 C160 90 145 88 140 100 C145 112 160 110 180 100Z" fill="currentColor" opacity="0.3" />
      {/* Diagonal petals */}
      <path d="M43 43 C55 62 62 72 75 75 C72 62 62 55 43 43Z" fill="currentColor" opacity="0.2" />
      <path d="M157 43 C145 62 138 72 125 75 C128 62 138 55 157 43Z" fill="currentColor" opacity="0.2" />
      <path d="M43 157 C55 138 62 128 75 125 C72 138 62 145 43 157Z" fill="currentColor" opacity="0.2" />
      <path d="M157 157 C145 138 138 128 125 125 C128 138 138 145 157 157Z" fill="currentColor" opacity="0.2" />
      {/* Small accent dots */}
      <circle cx="100" cy="100" r="4" fill="currentColor" opacity="0.8" />
      <circle cx="100" cy="50" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="100" cy="150" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="50" cy="100" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="150" cy="100" r="2" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

export default function Hero() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-hero-gradient">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large background ornaments */}
        <FloralOrnament className="absolute -top-20 -left-20 w-80 h-80 text-champagne-dark opacity-30" />
        <FloralOrnament className="absolute -bottom-20 -right-20 w-96 h-96 text-baby-blue-dark opacity-25" />
        <FloralOrnament className="absolute top-1/2 -translate-y-1/2 -right-16 w-64 h-64 text-gold opacity-10" />

        {/* Subtle gradient overlays */}
        <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-radial from-champagne-light/50 to-transparent opacity-70" />
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-baby-blue-light/40 to-transparent opacity-60" />

        {/* Floating dots – static values to avoid SSR/client hydration mismatch */}
        {[
          { w: 5.2, h: 6.8, l: 12, t: 20, dur: 3.4, del: 0.3 },
          { w: 3.8, h: 4.5, l: 27, t: 65, dur: 4.1, del: 1.1 },
          { w: 7.0, h: 3.5, l: 45, t: 80, dur: 3.8, del: 0.7 },
          { w: 4.2, h: 5.6, l: 60, t: 35, dur: 4.5, del: 1.5 },
          { w: 6.1, h: 4.0, l: 75, t: 55, dur: 3.2, del: 0.2 },
          { w: 3.5, h: 7.2, l: 88, t: 15, dur: 4.8, del: 0.9 },
          { w: 5.8, h: 3.8, l: 35, t: 90, dur: 3.6, del: 1.8 },
          { w: 4.8, h: 6.2, l: 52, t: 10, dur: 4.2, del: 0.5 },
        ].map((dot, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-gold/20"
            style={{ width: dot.w, height: dot.h, left: `${dot.l}%`, top: `${dot.t}%` }}
            animate={{ y: [0, -15, 0], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: dot.dur, repeat: Infinity, delay: dot.del }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          {/* Top badge */}
          <motion.div variants={itemVariants} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/70 backdrop-blur-sm text-dark-blue text-sm font-medium rounded-full border border-champagne-dark/30 shadow-sm">
              <Heart size={12} className="text-gold fill-gold" />
              Wir heiraten!
              <Heart size={12} className="text-gold fill-gold" />
            </span>
          </motion.div>

          {/* Top ornament */}
          <motion.div variants={itemVariants} className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/50" />
            <FloralOrnament className="w-10 h-10 text-gold" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/50" />
          </motion.div>

          {/* Main heading */}
          <motion.h1
            variants={itemVariants}
            className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-dark-blue leading-tight mb-2"
          >
            {couple.bride}
          </motion.h1>

          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center gap-4 my-2"
          >
            <div className="h-px w-20 bg-gold/40" />
            <span className="text-2xl text-gold font-serif">&amp;</span>
            <div className="h-px w-20 bg-gold/40" />
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-dark-blue leading-tight mb-6"
          >
            {couple.groom}
          </motion.h1>

          {/* Hashtag */}
          <motion.p
            variants={itemVariants}
            className="text-gold font-medium text-lg mb-8"
          >
            {couple.hashtag}
          </motion.p>

          {/* Date badges */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
          >
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

            {showTraditionalWeddingTab && (
              <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm border border-baby-blue/40 rounded-2xl px-6 py-4 shadow-sm">
                <div className="w-10 h-10 bg-baby-blue rounded-xl flex items-center justify-center flex-shrink-0">
                  <Heart size={18} className="text-dark-blue" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tamilische Hochzeit</p>
                  <p className="text-dark-blue font-semibold text-sm">{traditionalWedding.displayDate}</p>
                  <p className="text-xs text-gray-500">{traditionalWedding.venue}</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap"
          >
            <Link href="/info">
              <Button variant="primary" size="lg">
                Hochzeitsinfos
              </Button>
            </Link>
            <Link href="/story">
              <Button variant="secondary" size="lg">
                Unsere Geschichte
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-dark-blue/50"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.6 }}
      >
        <span className="text-xs font-medium tracking-widest uppercase">Mehr entdecken</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={20} />
        </motion.div>
      </motion.div>
    </section>
  )
}
