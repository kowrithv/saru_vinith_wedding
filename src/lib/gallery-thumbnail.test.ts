import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlaceholderThumbnailBlob, createThumbnailBlob } from './gallery-thumbnail'

function fakeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap
}

interface FakeContext {
  drawImage: ReturnType<typeof vi.fn>
  fillRect: ReturnType<typeof vi.fn>
  fillStyle: string
}

describe('gallery thumbnails', () => {
  const mockToBlob = vi.fn()
  const mockDrawImage = vi.fn()
  const mockFillRect = vi.fn()
  const mockGetContext = vi.fn((): FakeContext | null => null)
  let canvas: { width: number; height: number }
  let context: FakeContext

  beforeEach(() => {
    mockToBlob.mockReset()
    mockDrawImage.mockReset()
    mockFillRect.mockReset()
    context = { drawImage: mockDrawImage, fillRect: mockFillRect, fillStyle: '' }
    mockGetContext.mockReset().mockReturnValue(context)
    canvas = { width: 0, height: 0 }
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        Object.assign(canvas, { getContext: mockGetContext, toBlob: mockToBlob })
        return canvas as unknown as HTMLCanvasElement
      }
      return document.createElement(tag)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('createThumbnailBlob', () => {
    it('applies the image orientation and downscales a large image in two steps', async () => {
      const original = fakeBitmap(8000, 6000)
      const createImageBitmapMock = vi
        .fn()
        .mockImplementation((_source: unknown, options?: { imageOrientation?: string; resizeWidth?: number; resizeHeight?: number }) => {
          if (options && 'imageOrientation' in options) return Promise.resolve(original)
          return Promise.resolve(fakeBitmap(options?.resizeWidth ?? 0, options?.resizeHeight ?? 0))
        })
      vi.stubGlobal('createImageBitmap', createImageBitmapMock)
      const fakeBlob = new Blob(['thumb'])
      mockToBlob.mockImplementation((cb: (blob: Blob) => void) => cb(fakeBlob))

      const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
      const result = await createThumbnailBlob(file)

      expect(result).toBe(fakeBlob)
      expect(createImageBitmapMock).toHaveBeenCalledTimes(3)
      expect(createImageBitmapMock).toHaveBeenNthCalledWith(1, file, { imageOrientation: 'from-image' })
      expect(createImageBitmapMock).toHaveBeenNthCalledWith(
        2,
        original,
        expect.objectContaining({ resizeWidth: 4096, resizeHeight: 3072 })
      )
      expect(createImageBitmapMock).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ width: 4096, height: 3072 }),
        expect.objectContaining({ resizeWidth: 800, resizeHeight: 600 })
      )
      expect(canvas.width).toBe(800)
      expect(canvas.height).toBe(600)
      expect(mockDrawImage).toHaveBeenCalled()
      expect(mockToBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8)
    })

    it('skips resizing when the image is already small enough', async () => {
      const createImageBitmapMock = vi.fn().mockResolvedValue(fakeBitmap(400, 300))
      vi.stubGlobal('createImageBitmap', createImageBitmapMock)
      const fakeBlob = new Blob(['thumb'])
      mockToBlob.mockImplementation((cb: (blob: Blob) => void) => cb(fakeBlob))

      const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
      await createThumbnailBlob(file)

      // Nur der ursprüngliche createImageBitmap-Aufruf (ohne Resize-Optionen) -
      // kein zusätzlicher Downscale-Schritt für ein bereits kleines Bild.
      expect(createImageBitmapMock).toHaveBeenCalledTimes(1)
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

  describe('createPlaceholderThumbnailBlob', () => {
    it('fills a neutral square and returns it as a JPEG', async () => {
      const fakeBlob = new Blob(['placeholder'])
      mockToBlob.mockImplementation((cb: (blob: Blob) => void) => cb(fakeBlob))

      const result = await createPlaceholderThumbnailBlob()

      expect(result).toBe(fakeBlob)
      expect(canvas.width).toBe(400)
      expect(canvas.height).toBe(400)
      expect(context.fillStyle).toBe('#f5e6c8')
      expect(mockFillRect).toHaveBeenCalledWith(0, 0, 400, 400)
      expect(mockToBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8)
    })

    it('throws when the canvas context is unavailable', async () => {
      mockGetContext.mockReturnValueOnce(null)
      await expect(createPlaceholderThumbnailBlob()).rejects.toThrow('Canvas-Kontext nicht verfügbar.')
    })
  })
})
