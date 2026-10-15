'use client'

import { useState } from 'react'
import { ZoomIn } from 'lucide-react'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'
import { galleryCategories } from '@/lib/gallery-categories'
import { cn } from '@/lib/utils'
import EmptyState from '@/components/ui/EmptyState'
import ShowMoreButton from '@/components/ui/ShowMoreButton'
import GalleryLightbox from './GalleryLightbox'

// So viele Fotos werden auf einmal gezeigt; der Rest folgt auf Wunsch.
const PAGE_SIZE = 60

interface GalleryGridProps {
  photos: GalleryPhotoView[]
  onPhotoDeleted: (photoId: string) => void
  /** Ersetzt den Standardtext, wenn es noch keine Fotos gibt (z. B. bei pausiertem Upload). */
  emptyMessage?: string
}

interface FilterChipProps {
  active: boolean
  count: number
  onClick: () => void
  children: string
}

// Champagner mit Kante, damit der Filter auf dem hellen Hintergrund
// erkennbar ist; der aktive trägt eine Goldkante. Genau eine Schatten-Klasse:
// zwei würden dieselbe Variable setzen, im Stylesheet gewänne die spätere.
function FilterChip({ active, count, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-5 py-2 text-sm font-medium transition-colors duration-200',
        active
          ? 'border-dark-blue bg-dark-blue text-white shadow-[inset_0_-3px_0_var(--color-gold)]'
          : 'border-champagne-dark bg-champagne text-dark-blue hover:bg-champagne-dark'
      )}
    >
      {children}
      <span className="ml-1.5 text-xs opacity-70">({count})</span>
    </button>
  )
}

export default function GalleryGrid({ photos, onPhotoDeleted, emptyMessage }: GalleryGridProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Alle')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filteredPhotos = activeCategory === 'Alle' ? photos : photos.filter((p) => p.category === activeCategory)

  const selectCategory = (category: string) => {
    // Dieselbe Kategorie noch einmal anzutippen lässt die Liste, wie sie ist.
    if (category === activeCategory) return
    setActiveCategory(category)
    setVisibleCount(PAGE_SIZE)
  }

  const handleDeleted = (photoId: string) => {
    onPhotoDeleted(photoId)
    setLightboxIndex(null)
  }

  if (photos.length === 0) {
    return (
      <EmptyState title={emptyMessage ?? 'Noch keine Fotos'} description={emptyMessage ? undefined : 'Lade das erste hoch!'} />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        <FilterChip active={activeCategory === 'Alle'} count={photos.length} onClick={() => selectCategory('Alle')}>
          Alle
        </FilterChip>
        {galleryCategories.map((category) => (
          <FilterChip
            key={category}
            active={activeCategory === category}
            count={photos.filter((p) => p.category === category).length}
            onClick={() => selectCategory(category)}
          >
            {category}
          </FilterChip>
        ))}
      </div>

      {filteredPhotos.length === 0 ? (
        <EmptyState title="Keine Fotos in dieser Kategorie" />
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
          {filteredPhotos.slice(0, visibleCount).map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="block w-full mb-4 break-inside-avoid relative overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt={`Foto von ${photo.uploaderName}`}
                loading="lazy"
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-dark-blue/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <ZoomIn size={28} className="text-white" />
              </div>
              {/* Badge ist absichtlich immer sichtbar, nicht nur bei
                  group-hover: hover gibt es auf Touch-Geräten nicht, und
                  die meisten Gäste öffnen die Galerie am Handy. */}
              <div className="absolute bottom-2 left-2 right-2">
                <span
                  className={cn(
                    'inline-block text-xs font-medium px-2 py-1 rounded-full',
                    photo.isOfficial ? 'bg-dark-blue text-gold' : 'bg-white/90 text-dark-blue'
                  )}
                >
                  {photo.isOfficial ? photo.category : `Von ${photo.uploaderName}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {filteredPhotos.length > visibleCount && (
        <ShowMoreButton
          key={visibleCount}
          label={`${filteredPhotos.length - visibleCount > PAGE_SIZE ? PAGE_SIZE : filteredPhotos.length - visibleCount} weitere Fotos anzeigen`}
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        />
      )}

      {lightboxIndex !== null && (
        <GalleryLightbox
          photos={filteredPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
