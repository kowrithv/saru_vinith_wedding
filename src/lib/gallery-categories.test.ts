import { describe, expect, it } from 'vitest'
import {
  MEMORY_PHOTO_CATEGORY,
  galleryCategories,
  isCategoryAllowedForUpload,
  uploadCategoriesFor,
} from './gallery-categories'

describe('upload categories', () => {
  it('lets guests choose only the wedding day and the party', () => {
    expect(uploadCategoriesFor(false)).toEqual(['Standesamt', 'Party'])
  })

  it('lets the couple also file photos under the story categories', () => {
    expect(uploadCategoriesFor(true)).toEqual(['Kennenlernen', 'Verlobung', 'Standesamt', 'Party'])
  })

  it('never offers the memory category for manual uploads', () => {
    expect(uploadCategoriesFor(true)).not.toContain(MEMORY_PHOTO_CATEGORY)
    expect(uploadCategoriesFor(false)).not.toContain(MEMORY_PHOTO_CATEGORY)
  })

  it('no longer knows the former name "Hochzeit"', () => {
    expect(galleryCategories as readonly string[]).not.toContain('Hochzeit')
    expect(isCategoryAllowedForUpload('Hochzeit' as never, true)).toBe(false)
  })

  it('offers only categories that exist', () => {
    uploadCategoriesFor(true).forEach((category) => expect(galleryCategories).toContain(category))
  })

  describe('isCategoryAllowedForUpload', () => {
    it('accepts what a guest may choose and the category of memory photos', () => {
      expect(isCategoryAllowedForUpload('Standesamt', false)).toBe(true)
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
