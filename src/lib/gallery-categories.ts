export const galleryCategories = ['Kennenlernen', 'Verlobung', 'Hochzeit', 'Party', 'Erinnerungen'] as const

// Fotos, die Gäste an eine Erinnerung hängen, landen unter dieser Kategorie.
export const MEMORY_PHOTO_CATEGORY = 'Erinnerungen' as const satisfies (typeof galleryCategories)[number]

export type GalleryCategory = (typeof galleryCategories)[number]

// Vorauswahl im Upload-Formular: Gäste laden auf der Feier überwiegend
// Hochzeitsfotos hoch - die erste Kategorie der Liste wäre dafür falsch.
export const defaultGalleryCategory: GalleryCategory = 'Hochzeit'
