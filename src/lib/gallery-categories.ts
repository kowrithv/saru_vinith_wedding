export const galleryCategories = ['Kennenlernen', 'Verlobung', 'Hochzeit', 'Party'] as const

export type GalleryCategory = (typeof galleryCategories)[number]

// Vorauswahl im Upload-Formular: Gäste laden auf der Feier überwiegend
// Hochzeitsfotos hoch - die erste Kategorie der Liste wäre dafür falsch.
export const defaultGalleryCategory: GalleryCategory = 'Hochzeit'
