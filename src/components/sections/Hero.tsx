import type { CSSProperties } from 'react'
import { Calendar, ChevronDown, Heart } from 'lucide-react'
import Button from '@/components/ui/Button'
import { couple } from '@/lib/site-content'
import { receptionEvent } from '@/lib/event-info'
import { cn } from '@/lib/utils'
import HeroBadge from '@/components/sections/HeroBadge'

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

// Eintritts-Animation per CSS statt per JavaScript: der Server-HTML-Stand ist
// sichtbar, ohne dass erst ein Bundle laden und hydrieren muss, und Besucher
// mit "Bewegung reduzieren" bekommen sie gar nicht.
const enter = 'animate-fade-up motion-reduce:animate-none'

function stagger(step: number): CSSProperties {
  return { animationDelay: `${0.1 + step * 0.1}s` }
}

const nameClassName =
  'block font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-dark-blue leading-tight'

export default function Hero() {
  return (
    // pt-20 hält den Inhalt unter der fixen Navigation (64 px), pb-24 lässt
    // dem Hinweis unten Platz; min-h-svh bleibt auch dann eine Bildschirmhöhe
    // (border-box) und berücksichtigt die einklappende Safari-Leiste.
    <section className="relative min-h-svh flex items-center justify-center overflow-hidden pt-20 pb-24 bg-gradient-to-br from-champagne-light via-white to-baby-blue-light">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloralOrnament className="absolute -top-20 -left-20 w-80 h-80 text-champagne-dark opacity-30" />
        <FloralOrnament className="absolute -bottom-20 -right-20 w-96 h-96 text-baby-blue-dark opacity-25" />
        <FloralOrnament className="absolute top-1/2 -translate-y-1/2 -right-16 w-64 h-64 text-gold opacity-10" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center">
        <div className={cn(enter, 'mb-6')} style={stagger(0)}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/70 backdrop-blur-sm text-dark-blue text-sm font-medium rounded-full border border-champagne-dark/30 shadow-sm">
            <Heart size={12} className="text-gold fill-gold" />
            <HeroBadge />
            <Heart size={12} className="text-gold fill-gold" />
          </span>
        </div>

        <div className={cn(enter, 'flex items-center justify-center gap-4 mb-4')} style={stagger(1)}>
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/50" />
          <FloralOrnament className="w-10 h-10 text-gold" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/50" />
        </div>

        <h1 className={cn(enter, 'flex flex-col items-center mb-6')} style={stagger(2)}>
          <span className={cn(nameClassName, 'mb-2')}>{couple.bride}</span>
          <span className="flex items-center justify-center gap-4 my-2">
            <span className="block h-px w-20 bg-gold/40" />
            <span className="text-2xl text-gold-text font-serif">&amp;</span>
            <span className="block h-px w-20 bg-gold/40" />
          </span>
          <span className={nameClassName}>{couple.groom}</span>
        </h1>

        <p className={cn(enter, 'text-gold-text font-medium text-lg mb-8')} style={stagger(3)}>
          {couple.hashtag}
        </p>

        <div className={cn(enter, 'mb-10')} style={stagger(4)}>
          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm border border-champagne-dark/30 rounded-2xl px-6 py-4 shadow-sm">
            <div className="w-10 h-10 bg-dark-blue rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar size={18} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">Empfang</p>
              <p className="text-dark-blue font-semibold text-sm">{receptionEvent.displayDate}</p>
              <p className="text-xs text-gray-600">{receptionEvent.time} · {receptionEvent.venue}</p>
            </div>
          </div>
        </div>

        <div
          className={cn(enter, 'flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap')}
          style={stagger(5)}
        >
          <Button href="/info" variant="primary" size="lg">
            Hochzeitsinfos
          </Button>
          <Button href="/story" variant="secondary" size="lg">
            Unsere Geschichte
          </Button>
        </div>
      </div>

      {/* Echter Anker statt Dekoration: sieht anklickbar aus, also ist es das auch. */}
      <a
        href="#countdown"
        className={cn(
          enter,
          'absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 px-4 py-2 rounded-xl text-dark-blue/70 hover:text-dark-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-dark-blue'
        )}
        style={{ animationDelay: '1.2s' }}
      >
        <span className="text-xs font-medium tracking-widest uppercase">Mehr entdecken</span>
        <ChevronDown size={20} className="motion-safe:animate-bounce" />
      </a>
    </section>
  )
}
