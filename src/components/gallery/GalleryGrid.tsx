'use client'

import { useState } from 'react'
import { ZoomIn } from 'lucide-react'
import type { GalleryPhotoView } from '@/lib/gallery-photo-view'
import { galleryCategories } from '@/lib/gallery-categories'
import { cn } from '@/lib/utils'
import GalleryLightbox from './GalleryLightbox'

interface GalleryGridProps {
  photos: GalleryPhotoView[]
  onPhotoDeleted: (photoId: string) => void
}

export default function GalleryGrid({ photos, onPhotoDeleted }: GalleryGridProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Alle')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const filteredPhotos = activeCategory === 'Alle' ? photos : photos.filter((p) => p.category === activeCategory)

  const handleDeleted = (photoId: string) => {
    onPhotoDeleted(photoId)
    setLightboxIndex(null)
  }

  if (photos.length === 0) {
    return <p className="text-center text-gray-400 py-16">Noch keine Fotos – lade das erste hoch!</p>
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        <button
          type="button"
          onClick={() => setActiveCategory('Alle')}
          className={cn(
            'px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
            activeCategory === 'Alle'
              ? 'bg-dark-blue text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-champagne hover:text-dark-blue'
          )}
        >
          Alle
          <span className="ml-1.5 text-xs opacity-60">({photos.length})</span>
        </button>
        {galleryCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={cn(
              'px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
              activeCategory === category
                ? 'bg-dark-blue text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-champagne hover:text-dark-blue'
            )}
          >
            {category}
            <span className="ml-1.5 text-xs opacity-60">
              ({photos.filter((p) => p.category === category).length})
            </span>
          </button>
        ))}
      </div>

      {filteredPhotos.length === 0 ? (
        <p className="text-center text-gray-400 py-16">Keine Fotos in dieser Kategorie.</p>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
          {filteredPhotos.map((photo, index) => (
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
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-dark-blue/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <ZoomIn size={28} className="text-white" />
              </div>
              <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="inline-block bg-white/90 text-dark-blue text-xs font-medium px-2 py-1 rounded-full">
                  {photo.isOfficial ? photo.category : `Von ${photo.uploaderName}`}
                </span>
              </div>
            </button>
          ))}
        </div>
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
