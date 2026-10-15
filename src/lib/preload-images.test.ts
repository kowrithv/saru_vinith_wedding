import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('preloadImages', () => {
  const requested: string[] = []

  beforeEach(() => {
    requested.length = 0
    vi.resetModules()
    vi.stubGlobal(
      'Image',
      class {
        decoding = ''
        set src(value: string) {
          requested.push(value)
        }
      }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests every image once', async () => {
    const { preloadImages } = await import('./preload-images')
    preloadImages(['/a.jpg', '/b.jpg'])
    expect(requested).toEqual(['/a.jpg', '/b.jpg'])
  })

  it('does not request an image again when called repeatedly (new game, remount)', async () => {
    const { preloadImages } = await import('./preload-images')
    preloadImages(['/a.jpg', '/b.jpg'])
    preloadImages(['/b.jpg', '/c.jpg'])
    expect(requested).toEqual(['/a.jpg', '/b.jpg', '/c.jpg'])
  })

  it('does nothing without a browser', async () => {
    vi.unstubAllGlobals()
    const original = globalThis.Image
    // @ts-expect-error Browser-Klasse für diesen Test entfernen
    delete globalThis.Image
    try {
      const { preloadImages } = await import('./preload-images')
      expect(() => preloadImages(['/a.jpg'])).not.toThrow()
    } finally {
      globalThis.Image = original
    }
  })
})
