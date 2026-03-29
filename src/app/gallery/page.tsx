'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import { galleryImages } from '@/lib/config'

const categories = ['Alle', 'Kennenlernen', 'Verlobung', 'Paarfotos']

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export default function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState('Alle')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const filteredImages =
    activeCategory === 'Alle'
      ? galleryImages
      : galleryImages.filter((img) => img.category === activeCategory)

  const openLightbox = (index: number) => setLightboxIndex(index)
  const closeLightbox = () => setLightboxIndex(null)

  const navigateLightbox = useCallback(
    (direction: 'prev' | 'next') => {
      if (lightboxIndex === null) return
      const newIndex =
        direction === 'prev'
          ? (lightboxIndex - 1 + filteredImages.length) % filteredImages.length
          : (lightboxIndex + 1) % filteredImages.length
      setLightboxIndex(newIndex)
    },
    [lightboxIndex, filteredImages.length]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') navigateLightbox('prev')
      if (e.key === 'ArrowRight') navigateLightbox('next')
    },
    [navigateLightbox]
  )

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div variants={fadeInUp}>
            <SectionTitle
              title="Unsere Galerie"
              subtitle="Momente, die wir für immer in Erinnerung behalten – vom ersten Treffen bis heute."
            />
          </motion.div>

          {/* Category filter */}
          <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-2 mb-10">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeCategory === category
                    ? 'bg-dark-blue text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-champagne hover:text-dark-blue'
                }`}
              >
                {category}
                {category !== 'Alle' && (
                  <span className="ml-1.5 text-xs opacity-60">
                    ({galleryImages.filter((img) => img.category === category).length})
                  </span>
                )}
              </button>
            ))}
          </motion.div>

          {/* Masonry grid */}
          <motion.div
            layout
            className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4"
          >
            <AnimatePresence>
              {filteredImages.map((image, index) => (
                <motion.div
                  key={image.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="break-inside-avoid mb-4 cursor-pointer group relative overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow"
                  onClick={() => openLightbox(index)}
                >
                  <div className="relative w-full">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      width={image.width}
                      height={image.height}
                      className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-dark-blue/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <ZoomIn size={28} className="text-white" />
                    </div>
                    {/* Category badge */}
                    <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="inline-block bg-white/90 text-dark-blue text-xs font-medium px-2 py-1 rounded-full">
                        {image.category}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {filteredImages.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg">Keine Bilder in dieser Kategorie</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={closeLightbox}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            {/* Close button */}
            <button
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
              onClick={closeLightbox}
              aria-label="Schließen"
            >
              <X size={20} />
            </button>

            {/* Prev button */}
            <button
              className="absolute left-4 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); navigateLightbox('prev') }}
              aria-label="Vorheriges Bild"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Next button */}
            <button
              className="absolute right-4 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); navigateLightbox('next') }}
              aria-label="Nächstes Bild"
            >
              <ChevronRight size={24} />
            </button>

            {/* Image */}
            <motion.div
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="max-w-5xl max-h-[85vh] mx-8"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={filteredImages[lightboxIndex].src}
                alt={filteredImages[lightboxIndex].alt}
                width={filteredImages[lightboxIndex].width}
                height={filteredImages[lightboxIndex].height}
                className="max-h-[80vh] w-auto h-auto object-contain rounded-lg"
              />
              <div className="text-center mt-3">
                <p className="text-white/70 text-sm">{filteredImages[lightboxIndex].alt}</p>
                <p className="text-white/40 text-xs mt-1">
                  {lightboxIndex + 1} / {filteredImages.length}
                </p>
              </div>
            </motion.div>

            {/* Keyboard hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs flex gap-4">
              <span>← → Navigieren</span>
              <span>ESC Schließen</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
