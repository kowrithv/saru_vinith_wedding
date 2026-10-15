'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X, Heart } from 'lucide-react'
import Lotus from '@/components/ui/Lotus'
import { couple, navigationItems } from '@/lib/site-content'
import { cn } from '@/lib/utils'

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()

  // Menü beim Routenwechsel schließen - Zustand während des Renderns
  // anpassen statt in einem Effect, siehe react-hooks/set-state-in-effect.
  const [previousPathname, setPreviousPathname] = useState(pathname)
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname)
    setIsOpen(false)
  }

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled || isOpen
            ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-champagne'
            : 'bg-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link
              href="/"
              className="flex items-center gap-2"
              aria-label="Zur Startseite"
              onClick={() => setIsOpen(false)}
            >
              <Heart size={18} className="text-gold fill-gold" />
              <span className="font-serif text-xl font-semibold tracking-wide text-dark-blue">S &amp; V</span>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                      isActive ? 'text-dark-blue font-semibold' : 'text-gray-600 hover:text-dark-blue'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>

            <button
              onClick={() => setIsOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg text-dark-blue hover:bg-champagne/50 transition-colors"
              aria-label={isOpen ? 'Menü schließen' : 'Menü öffnen'}
              aria-expanded={isOpen}
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-40 bg-dark-blue lg:hidden"
          >
            <div className="flex flex-col h-full pt-20 pb-8 px-6">
              <div className="mb-6 flex flex-col items-center text-center">
                <Lotus size={34} className="text-gold" />
                <p className="mt-2 font-display text-3xl font-semibold text-white">{couple.combinedName}</p>
                <p className="mt-1 text-sm text-gold">{couple.hashtag}</p>
              </div>
              <nav className="flex-1 overflow-y-auto">
                <ul className="space-y-1">
                  {navigationItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            'flex items-center gap-3 border-b border-gold/25 px-1 py-3 font-display text-2xl font-medium transition-colors duration-200',
                            isActive ? 'text-gold' : 'text-white hover:text-gold'
                          )}
                        >
                          {isActive && <Lotus size={16} className="text-gold" />}
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
