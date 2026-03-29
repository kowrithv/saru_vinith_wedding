'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Heart } from 'lucide-react'
import { navigationItems, couple } from '@/lib/config'
import { cn } from '@/lib/utils'

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
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
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 group"
              aria-label="Zur Startseite"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2"
              >
                <Heart
                  size={18}
                  className="text-gold fill-gold"
                />
                <span
                  className={cn(
                    'font-serif text-xl font-semibold tracking-wide transition-colors duration-300',
                    isScrolled || isOpen ? 'text-dark-blue' : 'text-dark-blue'
                  )}
                >
                  S & V
                </span>
              </motion.div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 animated-underline',
                      isActive
                        ? 'text-dark-blue font-semibold'
                        : 'text-gray-600 hover:text-dark-blue'
                    )}
                  >
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-gold rounded-full"
                      />
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 rounded-lg text-dark-blue hover:bg-champagne/50 transition-colors"
              aria-label={isOpen ? 'Menü schließen' : 'Menü öffnen'}
              aria-expanded={isOpen}
            >
              <AnimatePresence mode="wait">
                {isOpen ? (
                  <motion.div
                    key="close"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X size={22} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ opacity: 0, rotate: 90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -90 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu size={22} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-40 bg-white lg:hidden"
          >
            <div className="flex flex-col h-full pt-20 pb-8 px-6">
              {/* Decorative header */}
              <div className="text-center mb-8">
                <p className="font-serif text-2xl text-dark-blue">{couple.combinedName}</p>
                <p className="text-sm text-gold mt-1">{couple.hashtag}</p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <div className="h-px w-16 bg-gradient-to-r from-transparent to-champagne-dark" />
                  <Heart size={12} className="text-gold fill-gold" />
                  <div className="h-px w-16 bg-gradient-to-l from-transparent to-champagne-dark" />
                </div>
              </div>

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto">
                <ul className="space-y-1">
                  {navigationItems.map((item, index) => {
                    const isActive = pathname === item.href
                    return (
                      <motion.li
                        key={item.href}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center justify-between px-4 py-3.5 rounded-xl text-base font-medium transition-all duration-200',
                            isActive
                              ? 'bg-dark-blue text-white'
                              : 'text-gray-700 hover:bg-champagne/50 hover:text-dark-blue'
                          )}
                        >
                          {item.label}
                          {isActive && (
                            <Heart size={14} className="text-gold fill-gold" />
                          )}
                        </Link>
                      </motion.li>
                    )
                  })}
                </ul>
              </nav>

              {/* Bottom decoration */}
              <div className="text-center text-xs text-gray-400 mt-6">
                <p>17. Oktober 2026</p>
                <p className="mt-1">Standesamtliche Trauung</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
