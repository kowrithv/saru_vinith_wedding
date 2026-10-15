import { couple } from '@/lib/site-content'
import { receptionEvent } from '@/lib/event-info'
import Lotus from '@/components/ui/Lotus'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-dark-blue text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-14">
        <div className="flex flex-col items-center text-center">
          <Lotus size={40} className="text-gold" />
          <p className="mt-3 font-display text-3xl font-semibold">{couple.combinedName}</p>
          <p className="mt-2 text-sm text-champagne-light/85">
            <span>Samstag, </span>
            <span>{receptionEvent.displayDate}</span> · {receptionEvent.venue.replace('Begegnungsstätte ', '')}
          </p>
          <div className="mt-5 flex items-center gap-2 text-gold" aria-hidden="true">
            <span className="h-1 w-1 rotate-45 bg-current" />
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="h-1 w-1 rotate-45 bg-current" />
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="h-1 w-1 rotate-45 bg-current" />
          </div>
          <p className="mt-4 text-sm font-medium text-gold">{couple.hashtag}</p>
        </div>

        <p className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/60">
          Mit Liebe gemacht &copy; {currentYear}
        </p>
      </div>
    </footer>
  )
}
