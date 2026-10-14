import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPreviewImage } from './gallery-preview'
import { createPlaceholderThumbnailBlob, createThumbnailBlob } from './gallery-thumbnail'
import { MAX_THUMB_BYTES } from './gallery-upload-limits'

vi.mock('./gallery-thumbnail', () => ({
  createThumbnailBlob: vi.fn(),
  createPlaceholderThumbnailBlob: vi.fn(),
}))

const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })

describe('createPreviewImage', () => {
  beforeEach(() => {
    vi.mocked(createThumbnailBlob).mockReset()
    vi.mocked(createPlaceholderThumbnailBlob).mockReset().mockResolvedValue(new Blob(['placeholder']))
  })

  it('returns the real preview', async () => {
    const blob = new Blob(['preview'])
    vi.mocked(createThumbnailBlob).mockResolvedValue(blob)

    await expect(createPreviewImage(file)).resolves.toEqual({ blob, isPlaceholder: false })
  })

  it('falls back to the neutral placeholder when the browser cannot decode the photo', async () => {
    vi.mocked(createThumbnailBlob).mockRejectedValue(new Error('HEIC'))

    const preview = await createPreviewImage(file)
    expect(preview.isPlaceholder).toBe(true)
    expect(preview.blob.size).toBe('placeholder'.length)
  })

  it('falls back to the placeholder when the preview would exceed the signed size limit', async () => {
    vi.mocked(createThumbnailBlob).mockResolvedValue(new Blob(['x'.repeat(MAX_THUMB_BYTES + 1)]))

    const preview = await createPreviewImage(file)
    expect(preview.isPlaceholder).toBe(true)
  })
})
