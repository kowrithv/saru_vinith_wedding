import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThumbnailBlob } from './gallery-thumbnail'

function fakeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap
}

describe('createThumbnailBlob', () => {
  const mockToBlob = vi.fn()
  const mockDrawImage = vi.fn()
  const mockGetContext = vi.fn((): { drawImage: typeof mockDrawImage } | null => ({ drawImage: mockDrawImage }))

  beforeEach(() => {
    mockToBlob.mockReset()
    mockDrawImage.mockReset()
    mockGetContext.mockReset().mockReturnValue({ drawImage: mockDrawImage })
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext: mockGetContext, toBlob: mockToBlob } as unknown as HTMLCanvasElement
      }
      return document.createElement(tag)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('downscales a large image in two steps and produces a JPEG thumbnail', async () => {
    const original = fakeBitmap(8000, 6000)
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockImplementation((_source: unknown, options?: { resizeWidth?: number; resizeHeight?: number }) => {
        if (!options) return Promise.resolve(original)
        return Promise.resolve(fakeBitmap(options.resizeWidth ?? 0, options.resizeHeight ?? 0))
      })
    )
    const fakeBlob = new Blob(['thumb'])
    mockToBlob.mockImplementation((cb: (blob: Blob) => void) => cb(fakeBlob))

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await createThumbnailBlob(file)

    expect(result).toBe(fakeBlob)
    expect(mockDrawImage).toHaveBeenCalled()
    expect(mockToBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8)
  })

  it('skips resizing when the image is already small enough', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap(400, 300)))
    const fakeBlob = new Blob(['thumb'])
    mockToBlob.mockImplementation((cb: (blob: Blob) => void) => cb(fakeBlob))

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await createThumbnailBlob(file)

    // Nur der ursprüngliche createImageBitmap-Aufruf (ohne Resize-Optionen) -
    // kein zusätzlicher Downscale-Schritt für ein bereits kleines Bild.
    expect(createImageBitmap).toHaveBeenCalledTimes(1)
  })

  it('rejects when the canvas cannot produce a blob', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap(400, 300)))
    mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => cb(null))

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(createThumbnailBlob(file)).rejects.toThrow('Thumbnail-Erstellung fehlgeschlagen.')
  })

  it('throws when the canvas context is unavailable', async () => {
    mockGetContext.mockReturnValueOnce(null)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap(400, 300)))

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(createThumbnailBlob(file)).rejects.toThrow('Canvas-Kontext nicht verfügbar.')
  })
})
