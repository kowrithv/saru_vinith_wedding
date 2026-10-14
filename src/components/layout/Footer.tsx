import { Heart } from 'lucide-react'
import { couple } from '@/lib/site-content'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-dark-blue text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Heart size={16} className="text-gold fill-gold" />
            <span className="font-serif text-2xl font-semibold text-white">
              {couple.combinedName}
            </span>
          </div>
          <p className="text-baby-blue text-sm leading-relaxed">
            Zwei Herzen, eine Liebe. Wir freuen uns, diesen besonderen
            Moment mit euch zu teilen.
          </p>
          <p className="mt-3 text-gold text-sm font-medium">{couple.hashtag}</p>
        </div>

        <div className="mt-10 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
              <span>Empfang: 17. Oktober 2026</span>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              Mit
              <Heart size={10} className="text-gold fill-gold inline" />
              gemacht &copy; {currentYear}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
