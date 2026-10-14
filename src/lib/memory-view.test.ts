import { beforeEach, describe, expect, it } from 'vitest'
import { toMemoryEntryView } from './memory-view'
import type { MemoryEntry } from './memories'

const withPhoto: MemoryEntry = {
  id: 1,
  name: 'Anna',
  message: 'Mit Foto von damals, lang genug.',
  photo: { id: 'p1', thumbKey: 'gallery/p1/thumb.jpg', originalKey: 'gallery/p1/original.jpg' },
  createdAt: '2026-10-14T10:00:00.000Z',
}

describe('toMemoryEntryView', () => {
  beforeEach(() => {
    process.env.R2_PUBLIC_BASE_URL = 'https://fotos.example.de'
  })

  it('builds public URLs and never exposes the storage keys', () => {
    const view = toMemoryEntryView(withPhoto, { showPhoto: true })

    expect(view.photo).toEqual({
      id: 'p1',
      thumbUrl: 'https://fotos.example.de/gallery/p1/thumb.jpg',
      originalUrl: 'https://fotos.example.de/gallery/p1/original.jpg',
    })
    expect(JSON.stringify(view)).not.toContain('thumbKey')
    expect(JSON.stringify(view)).not.toContain('originalKey')
  })

  it('hides the photo from a locked browser but says that there is one', () => {
    const view = toMemoryEntryView(withPhoto, { showPhoto: false })

    expect(view.photo).toBeNull()
    expect(view.hasPhoto).toBe(true)
  })

  it('has no photo at all for a text-only entry', () => {
    const view = toMemoryEntryView({ ...withPhoto, photo: null }, { showPhoto: true })

    expect(view.photo).toBeNull()
    expect(view.hasPhoto).toBe(false)
  })
})
