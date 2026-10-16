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

// Mosaik: Das neueste Foto und danach jedes 7. ist doppelt so groß (2 x 2 Kacheln), gezählt von
// oben in der gezeigten Liste. Die Größe hängt an der Position; kommt ein neues Foto dazu, rückt
// der Rhythmus um eins weiter. Das ist gewollt (nur Kosmetik, Scrollende bekommen neue Fotos
// erst auf Tipp). Auf 1 gestellt sind alle Kacheln gleich: das ist der Rückfall auf ein ruhiges Raster.
const BIG_TILE_EVERY = 7

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
  // Die offene Großansicht merkt sich das Foto, nicht die Position: kommen beim
  // Neuladen der Galerie neue Fotos nach vorn, bleibt sie beim selben Bild.
  const [lightboxId, setLightboxId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Nur Kategorien mit Fotos sind ein Filter; eine leere zu zeigen führte zu
  // "Keine Fotos in dieser Kategorie". Verschwindet die gewählte Kategorie (das
  // letzte Foto wurde gelöscht), gilt wieder "Alle".
  const categoryCounts = new Map<string, number>(galleryCategories.map((category) => [category, 0]))
  for (const photo of photos) {
    categoryCounts.set(photo.category, (categoryCounts.get(photo.category) ?? 0) + 1)
  }
  const shownCategories = galleryCategories.filter((category) => (categoryCounts.get(category) ?? 0) > 0)
  const category = activeCategory !== 'Alle' && (categoryCounts.get(activeCategory) ?? 0) > 0 ? activeCategory : 'Alle'

  const filteredPhotos = category === 'Alle' ? photos : photos.filter((p) => p.category === category)
  const lightboxIndex = lightboxId === null ? -1 : filteredPhotos.findIndex((p) => p.id === lightboxId)

  const selectCategory = (next: string) => {
    // Dieselbe Kategorie noch einmal anzutippen lässt die Liste, wie sie ist.
    if (next === category) return
    setActiveCategory(next)
    setLightboxId(null)
    setVisibleCount(PAGE_SIZE)
  }

  const handleDeleted = (photoId: string) => {
    onPhotoDeleted(photoId)
    setLightboxId(null)
  }

  if (photos.length === 0) {
    return (
      <EmptyState title={emptyMessage ?? 'Noch keine Fotos'} description={emptyMessage ? undefined : 'Lade das erste hoch!'} />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        <FilterChip active={category === 'Alle'} count={photos.length} onClick={() => selectCategory('Alle')}>
          Alle
        </FilterChip>
        {shownCategories.map((name) => (
          <FilterChip
            key={name}
            active={category === name}
            count={categoryCounts.get(name) ?? 0}
            onClick={() => selectCategory(name)}
          >
            {name}
          </FilterChip>
        ))}
      </div>

      {/* Das Raster liest Zeile für Zeile (neueste zuerst) und füllt Lücken auf. Die Zeilenhöhe ist
          die Spaltenbreite (Container-Einheit cqw), damit jede Kachel quadratisch ist und eine große
          genau zwei mal zwei Kacheln deckt, auch wenn in ihrer Zeile sonst nichts mehr steht. */}
      <div className="@container">
        <div className="grid grid-cols-[repeat(var(--cols),1fr)] auto-rows-[calc((100cqw_-_(var(--cols)_-_1)_*_var(--gap))_/_var(--cols))] gap-[var(--gap)] [grid-auto-flow:dense] [--cols:3] [--gap:3px] sm:[--cols:5] lg:[--cols:6]">
          {filteredPhotos.slice(0, visibleCount).map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxId(photo.id)}
              className={cn(
                'relative block overflow-hidden rounded-lg bg-champagne/60 group',
                index % BIG_TILE_EVERY === 0 && 'col-span-2 row-span-2'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt={`Foto von ${photo.uploaderName}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-dark-blue/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <ZoomIn size={28} className="text-white" />
              </div>
              {/* Badge ist absichtlich immer sichtbar, nicht nur bei
                  group-hover: hover gibt es auf Touch-Geräten nicht, und
                  die meisten Gäste öffnen die Galerie am Handy. */}
              <div className="absolute bottom-1.5 left-1.5 right-1.5 text-left">
                <span
                  className={cn(
                    'inline-block max-w-full truncate text-xs font-medium px-2 py-1 rounded-full',
                    photo.isOfficial ? 'bg-dark-blue text-gold' : 'bg-white/90 text-dark-blue'
                  )}
                >
                  {photo.isOfficial ? photo.category : `Von ${photo.uploaderName}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {filteredPhotos.length > visibleCount && (
        <ShowMoreButton
          key={visibleCount}
          label={`${filteredPhotos.length - visibleCount > PAGE_SIZE ? PAGE_SIZE : filteredPhotos.length - visibleCount} weitere Fotos anzeigen`}
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        />
      )}

      {lightboxIndex >= 0 && (
        <GalleryLightbox
          photos={filteredPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxId(null)}
          onNavigate={(next) => setLightboxId(filteredPhotos[next]?.id ?? null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
