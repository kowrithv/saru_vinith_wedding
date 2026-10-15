import type { CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import HeroActions from '@/components/sections/HeroActions'
import Lotus from '@/components/ui/Lotus'
import { couple } from '@/lib/site-content'
import { receptionEvent } from '@/lib/event-info'
import { cn } from '@/lib/utils'
import { heroPhoto } from '@/lib/site-images'
import HeroBadge from '@/components/sections/HeroBadge'

// Eintritts-Animation per CSS statt per JavaScript: der Server-HTML-Stand ist
// sichtbar, ohne dass erst ein Bundle laden und hydrieren muss, und Besucher
// mit "Bewegung reduzieren" bekommen sie gar nicht.
const enter = 'animate-fade-up motion-reduce:animate-none'

function stagger(step: number): CSSProperties {
  return { animationDelay: `${0.1 + step * 0.1}s` }
}

export default function Hero() {
  return (
    // pt-20 hält den Inhalt unter der fixen Navigation (64 px), pb-24 lässt
    // dem Hinweis unten Platz; min-h-svh bleibt auch dann eine Bildschirmhöhe
    // (border-box) und berücksichtigt die einklappende Safari-Leiste.
    <section className="relative min-h-svh flex items-center justify-center overflow-hidden pt-20 pb-24 bg-gradient-to-b from-champagne-light via-white to-rose-sand-light">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <Lotus size={300} className="absolute -top-16 -left-20 text-champagne-dark opacity-30" />
        <Lotus size={340} className="absolute -bottom-20 -right-24 text-rose-sand opacity-50" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center">
        <p
          className={cn(
            enter,
            'mb-5 font-display text-sm sm:text-base font-semibold uppercase tracking-[0.3em] text-bordeaux'
          )}
          style={stagger(0)}
        >
          <HeroBadge />
        </p>

        <div className={cn(enter, 'mb-6')} style={stagger(1)}>
          {/* Bogenrahmen: die Form von Torbogen und Mandap. */}
          <div
            data-testid="hero-arch"
            className="relative h-60 w-48 sm:h-72 sm:w-56 overflow-hidden rounded-t-full rounded-b-md bg-champagne shadow-[0_0_0_6px_#fff,0_0_0_7px_var(--color-gold),0_18px_40px_rgba(30,58,95,0.18)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroPhoto}
              alt="Saruga und Vinith"
              width={650}
              height={1200}
              fetchPriority="high"
              className="h-full w-full object-cover object-[50%_32%]"
            />
          </div>
        </div>

        <h1
          className={cn(
            enter,
            'font-display font-semibold text-dark-blue leading-none text-5xl sm:text-6xl md:text-7xl flex flex-wrap items-baseline justify-center gap-x-3 mb-5'
          )}
          style={stagger(2)}
        >
          <span>{couple.bride}</span>
          <span className="font-script text-gold-text text-4xl sm:text-5xl md:text-6xl font-normal">&amp;</span>
          <span>{couple.groom}</span>
        </h1>

        <div className={cn(enter, 'flex items-center justify-center gap-4 mb-5')} style={stagger(3)}>
          <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/60" />
          <Lotus size={22} className="text-gold" />
          <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/60" />
        </div>

        <div className={cn(enter, 'mb-2')} style={stagger(4)}>
          <p className="font-display text-xl sm:text-2xl font-semibold text-dark-blue">
            <span>Samstag, </span>
            <span>{receptionEvent.displayDate}</span>
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {receptionEvent.time} · {receptionEvent.venue}
          </p>
        </div>

        <p className={cn(enter, 'text-gold-text font-medium mb-8')} style={stagger(5)}>
          {couple.hashtag}
        </p>

        <div
          className={cn(enter, 'flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap')}
          style={stagger(6)}
        >
          <HeroActions />
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
