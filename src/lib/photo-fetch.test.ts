import { afterEach, describe, expect, it, vi } from 'vitest'
import { corsPhotoUrl, fetchPhotoBlob } from './photo-fetch'

describe('corsPhotoUrl', () => {
  it('makes the CORS request a separate address from the one the <img> uses', () => {
    const plain = 'https://fotos.example.de/gallery/abc/thumb.jpg'
    const cors = corsPhotoUrl(plain)

    expect(cors).toBe('https://fotos.example.de/gallery/abc/thumb.jpg?cors=1')
    expect(cors).not.toBe(plain)
  })

  it('keeps an existing query and does not add the parameter twice', () => {
    expect(corsPhotoUrl('https://fotos.example.de/a.jpg?v=2')).toBe('https://fotos.example.de/a.jpg?v=2&cors=1')
    expect(corsPhotoUrl('https://fotos.example.de/a.jpg?cors=1')).toBe('https://fotos.example.de/a.jpg?cors=1')
  })

  it('also works for a path on the same site', () => {
    expect(corsPhotoUrl('/who/saruga.jpg')).toMatch(/\/who\/saruga\.jpg\?cors=1$/)
  })
})

describe('fetchPhotoBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the separate address in CORS mode and returns the blob', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => blob }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPhotoBlob('https://fotos.example.de/a.jpg')).resolves.toBe(blob)

    expect(fetchMock).toHaveBeenCalledWith('https://fotos.example.de/a.jpg?cors=1', { mode: 'cors' })
  })

  it('fails with a clear message when the server answers with an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, blob: async () => new Blob() })))

    await expect(fetchPhotoBlob('https://fotos.example.de/a.jpg')).rejects.toThrow('Foto konnte nicht geladen werden.')
  })
})
