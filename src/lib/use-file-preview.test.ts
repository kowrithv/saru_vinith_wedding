import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFilePreview } from './use-file-preview'
import { createPreviewImage } from './gallery-preview'

vi.mock('./gallery-preview', () => ({ createPreviewImage: vi.fn() }))

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

describe('useFilePreview', () => {
  let counter = 0

  beforeEach(() => {
    counter = 0
    vi.mocked(createPreviewImage).mockResolvedValue({ blob: new Blob(['t']), isPlaceholder: false })
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => `blob:preview-${++counter}`),
      configurable: true,
      writable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
  })

  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
    vi.mocked(createPreviewImage).mockReset()
  })

  it('has nothing to show without a photo', () => {
    const { result } = renderHook(() => useFilePreview(null))
    expect(result.current).toBeNull()
    expect(createPreviewImage).not.toHaveBeenCalled()
  })

  it('is undefined while the preview is being made, then gives its address', async () => {
    const file = photo('urlaub.jpg')
    const { result } = renderHook(() => useFilePreview(file))
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toBe('blob:preview-1'))
  })

  it('gives null for the neutral placeholder (a photo the browser cannot decode, e.g. HEIC)', async () => {
    vi.mocked(createPreviewImage).mockResolvedValue({ blob: new Blob(['p']), isPlaceholder: true })
    const file = photo('foto.heic')
    const { result } = renderHook(() => useFilePreview(file))
    await waitFor(() => expect(result.current).toBeNull())
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('gives null when making the preview fails unexpectedly', async () => {
    vi.mocked(createPreviewImage).mockRejectedValue(new Error('kaputt'))
    const file = photo('foto.jpg')
    const { result } = renderHook(() => useFilePreview(file))
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('lets go of the old address when another photo is chosen and when it is unmounted', async () => {
    const first = photo('eins.jpg')
    const second = photo('zwei.jpg')
    const { result, rerender, unmount } = renderHook(({ file }) => useFilePreview(file), { initialProps: { file: first } })
    await waitFor(() => expect(result.current).toBe('blob:preview-1'))

    rerender({ file: second })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1')
    await waitFor(() => expect(result.current).toBe('blob:preview-2'))

    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-2')
  })

  it('ignores a late answer for a photo that is no longer chosen', async () => {
    let resolveFirst: (value: { blob: Blob; isPlaceholder: boolean }) => void = () => {}
    vi.mocked(createPreviewImage)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ blob: new Blob(['2']), isPlaceholder: false })
    const first = photo('eins.jpg')
    const second = photo('zwei.jpg')
    const { result, rerender } = renderHook(({ file }) => useFilePreview(file), { initialProps: { file: first } })

    rerender({ file: second })
    await waitFor(() => expect(result.current).toBe('blob:preview-1'))
    resolveFirst({ blob: new Blob(['1']), isPlaceholder: false })
    await Promise.resolve()

    expect(result.current).toBe('blob:preview-1')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })
})
