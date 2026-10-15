export const galleryCategories = ['Kennenlernen', 'Verlobung', 'Standesamt', 'Party', 'Erinnerungen'] as const

// Fotos, die Gäste an eine Erinnerung hängen, landen unter dieser Kategorie.
export const MEMORY_PHOTO_CATEGORY = 'Erinnerungen' as const satisfies (typeof galleryCategories)[number]

export type GalleryCategory = (typeof galleryCategories)[number]

// Vorauswahl im Upload-Formular: Gäste laden auf der Feier überwiegend
// Hochzeitsfotos hoch - die erste Kategorie der Liste wäre dafür falsch.
export const defaultGalleryCategory: GalleryCategory = 'Standesamt'

// Beim manuellen Hochladen wählen Gäste nur den Tag selbst: Kennenlernen und
// Verlobung sind die Fotos des Brautpaars (nur der Admin legt sie an), und
// Erinnerungen entsteht allein über das Erinnerungs-Formular.
const GUEST_UPLOAD_CATEGORIES: readonly GalleryCategory[] = ['Standesamt', 'Party']
const ADMIN_UPLOAD_CATEGORIES: readonly GalleryCategory[] = ['Kennenlernen', 'Verlobung', 'Standesamt', 'Party']

/** Kategorien, die im Upload-Formular zur Auswahl stehen. */
export function uploadCategoriesFor(isAdmin: boolean): readonly GalleryCategory[] {
  return isAdmin ? ADMIN_UPLOAD_CATEGORIES : GUEST_UPLOAD_CATEGORIES
}

/**
 * Was der Server für eine Upload-Anfrage akzeptiert: die Auswahl aus dem
 * Formular und die Kategorie der Erinnerungs-Fotos (die kommen über dieselbe
 * Anfrage, nur nicht aus der Auswahl).
 */
export function isCategoryAllowedForUpload(category: GalleryCategory, isAdmin: boolean): boolean {
  return category === MEMORY_PHOTO_CATEGORY || uploadCategoriesFor(isAdmin).includes(category)
}
