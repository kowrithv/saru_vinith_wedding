import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadPhotoForTicket } from './photo-upload'
import { createPreviewImage } from './gallery-preview'

vi.mock('./gallery-preview', () => ({ createPreviewImage: vi.fn() }))

const file = new File(['x'.repeat(100)], 'foto.jpg', { type: 'image/jpeg' })

type FetchCall = [string, RequestInit]

function callsOf(fetchMock: { mock: { calls: unknown[] } }): FetchCall[] {
  return fetchMock.mock.calls as FetchCall[]
}

function ok(body: unknown = {}) {
  return { ok: true, status: 200, json: async () => body } as Response
}
function fail(status: number, body: unknown = {}) {
  return { ok: false, status, json: async () => body } as Response
}

const ticketResponse = {
  tickets: [
    { photoId: 'p1', thumbPutUrl: 'https://r2.example/thumb', originalPutUrl: 'https://r2.example/original', ticket: 'T1' },
  ],
}

describe('uploadPhotoForTicket', () => {
  beforeEach(() => {
    vi.mocked(createPreviewImage).mockReset().mockResolvedValue({ blob: new Blob(['preview']), isPlaceholder: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for a ticket with the preview size, uploads both objects and returns the ticket', async () => {
    const fetchMock = vi.fn(async (url: string) => (url === '/api/uploads/request' ? ok(ticketResponse) : ok()))
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadPhotoForTicket({ file, contentType: 'image/jpeg', category: 'Erinnerungen' })

    expect(result).toEqual({ ok: true, ticket: 'T1' })
    const [, init] = callsOf(fetchMock)[0]
    expect(JSON.parse(init.body as string)).toEqual({
      category: 'Erinnerungen',
      files: [{ filename: 'foto.jpg', size: 100, contentType: 'image/jpeg', thumbSize: 'preview'.length }],
    })
    const urls = callsOf(fetchMock).map(([url]) => url)
    expect(urls).toEqual(['/api/uploads/request', 'https://r2.example/thumb', 'https://r2.example/original'])
    const original = callsOf(fetchMock)[2][1]
    expect(original.method).toBe('PUT')
    expect((original.headers as Record<string, string>)['Content-Type']).toBe('image/jpeg')
  })

  it('sends the password only when one is given', async () => {
    const fetchMock = vi.fn(async (url: string) => (url === '/api/uploads/request' ? ok(ticketResponse) : ok()))
    vi.stubGlobal('fetch', fetchMock)

    await uploadPhotoForTicket({ file, contentType: 'image/jpeg', category: 'Erinnerungen', password: 'Hochzeit' })

    const body = JSON.parse(callsOf(fetchMock)[0][1].body as string)
    expect(body.password).toBe('Hochzeit')
  })

  it('reports a rejected password and flags that the remembered session is gone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fail(401, { error: 'Falsches Kennwort.' })))

    const result = await uploadPhotoForTicket({ file, contentType: 'image/jpeg', category: 'Erinnerungen' })

    expect(result).toEqual({ ok: false, error: 'Falsches Kennwort.', unauthorized: true })
  })

  it('passes on the server message when uploads are paused', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fail(423, { error: 'Foto-Uploads sind derzeit pausiert.' })))

    const result = await uploadPhotoForTicket({ file, contentType: 'image/jpeg', category: 'Erinnerungen' })

    expect(result).toMatchObject({ ok: false, error: 'Foto-Uploads sind derzeit pausiert.' })
  })

  it('fails with a clear message when R2 rejects a transfer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/uploads/request' ? ok(ticketResponse) : url.endsWith('/original') ? fail(403) : ok()
      )
    )

    const result = await uploadPhotoForTicket({ file, contentType: 'image/jpeg', category: 'Erinnerungen' })

    expect(result).toMatchObject({ ok: false, error: 'Übertragung fehlgeschlagen.' })
  })

  it('fails without throwing when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await uploadPhotoForTicket({ file, contentType: 'image/jpeg', category: 'Erinnerungen' })

    expect(result).toMatchObject({ ok: false })
  })

  it('gives up with a timeout message instead of waiting forever', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url === '/api/uploads/request') return Promise.resolve(ok(ticketResponse))
          return new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          })
        })
      )

      const pending = uploadPhotoForTicket({ file, contentType: 'image/jpeg', category: 'Erinnerungen' })
      await vi.advanceTimersByTimeAsync(16 * 60 * 1000)

      await expect(pending).resolves.toMatchObject({ ok: false, error: expect.stringMatching(/zeit/i) })
    } finally {
      vi.useRealTimers()
    }
  })
})
