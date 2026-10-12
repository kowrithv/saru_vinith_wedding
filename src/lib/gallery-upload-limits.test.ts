import { describe, expect, it } from 'vitest'
import { IMAGE_CONTENT_TYPE_EXTENSIONS, MAX_ORIGINAL_BYTES, resolveImageContentType } from './gallery-upload-limits'

describe('gallery upload limits', () => {
  it('allows the image types phones produce and caps originals at 20 MB', () => {
    expect([...IMAGE_CONTENT_TYPE_EXTENSIONS.keys()]).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ])
    expect(MAX_ORIGINAL_BYTES).toBe(20 * 1024 * 1024)
  })
})

describe('resolveImageContentType', () => {
  it('returns the type the browser reports when there is one', () => {
    expect(resolveImageContentType({ name: 'a.jpg', type: 'image/jpeg' })).toBe('image/jpeg')
  })

  it('infers the type from the file extension when the browser reports none (HEIC in Chrome)', () => {
    expect(resolveImageContentType({ name: 'IMG_0001.HEIC', type: '' })).toBe('image/heic')
    expect(resolveImageContentType({ name: 'IMG_0002.jpeg', type: '' })).toBe('image/jpeg')
  })

  it('returns an empty string for an unknown extension', () => {
    expect(resolveImageContentType({ name: 'notes.txt', type: '' })).toBe('')
    expect(resolveImageContentType({ name: 'no-extension', type: '' })).toBe('')
  })

  it('does not treat Object.prototype property names as extensions', () => {
    expect(resolveImageContentType({ name: 'x.constructor', type: '' })).toBe('')
  })
})
