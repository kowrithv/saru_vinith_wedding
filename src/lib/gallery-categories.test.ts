import { describe, expect, it } from 'vitest'
import {
  MEMORY_PHOTO_CATEGORY,
  galleryCategories,
  isCategoryAllowedForUpload,
  uploadCategoriesFor,
} from './gallery-categories'

describe('upload categories', () => {
  it('lets guests choose only the wedding day and the party', () => {
    expect(uploadCategoriesFor(false)).toEqual(['Hochzeit', 'Party'])
  })

  it('lets the couple also file photos under the story categories', () => {
    expect(uploadCategoriesFor(true)).toEqual(['Kennenlernen', 'Verlobung', 'Hochzeit', 'Party'])
  })

  it('never offers the memory category for manual uploads', () => {
    expect(uploadCategoriesFor(true)).not.toContain(MEMORY_PHOTO_CATEGORY)
    expect(uploadCategoriesFor(false)).not.toContain(MEMORY_PHOTO_CATEGORY)
  })

  it('offers only categories that exist', () => {
    uploadCategoriesFor(true).forEach((category) => expect(galleryCategories).toContain(category))
  })

  describe('isCategoryAllowedForUpload', () => {
    it('accepts what a guest may choose and the category of memory photos', () => {
      expect(isCategoryAllowedForUpload('Hochzeit', false)).toBe(true)
      expect(isCategoryAllowedForUpload('Party', false)).toBe(true)
      expect(isCategoryAllowedForUpload('Erinnerungen', false)).toBe(true)
    })

    it('keeps the story categories for the couple', () => {
      expect(isCategoryAllowedForUpload('Kennenlernen', false)).toBe(false)
      expect(isCategoryAllowedForUpload('Verlobung', false)).toBe(false)
      expect(isCategoryAllowedForUpload('Kennenlernen', true)).toBe(true)
      expect(isCategoryAllowedForUpload('Verlobung', true)).toBe(true)
    })
  })
})
