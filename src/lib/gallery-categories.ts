export const galleryCategories = ['Kennenlernen', 'Verlobung', 'Hochzeit', 'Party'] as const

export type GalleryCategory = (typeof galleryCategories)[number]
