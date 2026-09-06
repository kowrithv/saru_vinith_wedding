import Link from 'next/link'
import { Heart } from 'lucide-react'
import { couple, navigationItems } from '@/lib/config'
import { getVisibilityMap } from '@/lib/site-settings'

export default async function Footer() {
  const currentYear = new Date().getFullYear()
  const visibility = await getVisibilityMap()
  const visibleNavigationItems = navigationItems.filter(
    (item) => item.href === '/' || visibility[item.href.slice(1) as keyof typeof visibility]
  )

  return (
    <footer className="bg-dark-blue text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {/* Brand */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
              <Heart size={16} className="text-gold fill-gold" />
              <span className="font-serif text-2xl font-semibold text-white">
                {couple.combinedName}
              </span>
            </div>
            <p className="text-baby-blue text-sm leading-relaxed">
              Zwei Herzen, zwei Kulturen, eine Liebe. Wir freuen uns, diesen
              besonderen Moment mit euch zu teilen.
            </p>
            <p className="mt-3 text-gold text-sm font-medium">{couple.hashtag}</p>
          </div>

          {/* Navigation */}
          <div className="text-center">
            <h3 className="font-serif text-lg font-medium text-champagne mb-4">
              Navigation
            </h3>
            <nav>
              <ul className="space-y-2">
                {visibleNavigationItems.slice(0, 4).map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-gray-300 hover:text-white transition-colors animated-underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="text-center md:text-right">
            <h3 className="font-serif text-lg font-medium text-champagne mb-4">
              Weitere Seiten
            </h3>
            <nav>
              <ul className="space-y-2">
                {visibleNavigationItems.slice(4).map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-gray-300 hover:text-white transition-colors animated-underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-10 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Dates */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
              <span>Empfang: 17. Oktober 2026</span>
              <span className="hidden md:inline text-gray-600">|</span>
              <span>Tamilische Hochzeit: 2027</span>
            </div>

            {/* Copyright */}
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              Mit
              <Heart size={10} className="text-gold fill-gold inline" />
              gemacht &copy; {currentYear}
              <span className="text-gray-700">·</span>
              <Link href="/admin" className="text-gray-500 hover:text-gold transition-colors">
                Admin
              </Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
