import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'
import { setFeatureLocked } from '@/lib/app-config'
import { getDb } from '@/lib/db'
import { GALLERY_COOKIE_NAME, createGallerySessionCookieValue } from '@/lib/gallery-auth'
import { getOrCreateAdminSecret } from '@/lib/admin-auth'
import { signUploadTicket, type TicketPayload } from '@/lib/upload-ticket'
import { listGalleryPhotos } from '@/lib/gallery-photos'
import { addMemoryEntry, listMemoryEntries } from '@/lib/memories'
import { addGalleryPhoto, deleteGalleryPhotoRow } from '@/lib/gallery-photos'

const mockHeadObject = vi.fn()
vi.mock('@/lib/r2', () => ({
  headObject: (key: string) => mockHeadObject(key),
}))

function listMemoryEntriesCount(): number {
  return listMemoryEntries(getDb()).length
}

function photoPayload(overrides: Partial<TicketPayload> = {}): TicketPayload {
  return {
    photoId: 'photo-1',
    thumbKey: 'gallery/photo-1/thumb.jpg',
    originalKey: 'gallery/photo-1/original.jpg',
    thumbMaxSize: 50_000,
    originalSize: 3_000_000,
    expiresAt: Date.now() + 60_000,
    category: 'Erinnerungen',
    isOfficial: false,
    ...overrides,
  }
}

function signedTicket(overrides: Partial<TicketPayload> = {}): string {
  return signUploadTicket(photoPayload(overrides), getOrCreateAdminSecret(getDb()))
}

function objectsExist() {
  mockHeadObject.mockImplementation(async (key: string) =>
    key.endsWith('thumb.jpg') ? { size: 40_000 } : { size: 3_000_000 }
  )
}

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/memories', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalPassword = process.env.GUEST_PASSWORD

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.GUEST_PASSWORD = 'empfang-secret'
    process.env.R2_PUBLIC_BASE_URL = 'https://fotos.example.de'
    mockHeadObject.mockReset()
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    process.env.GUEST_PASSWORD = originalPassword
  })

  it('POST with the correct password adds a text-only entry', async () => {
    const response = await POST(
      postRequest({
        name: 'Anna',
        message: 'Ich erinnere mich an den Tag eures Kennenlernens.',
        password: 'empfang-secret',
      })
    )
    expect(response.status).toBe(201)

    const getResponse = await GET(new Request('http://localhost/api/memories'))
    const body = await getResponse.json()
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0].photo).toBeNull()
    expect(body.entries[0].hasPhoto).toBe(false)
  })

  it('POST rejects a wrong password without revealing anything else', async () => {
    const response = await POST(
      postRequest({
        name: 'Anna',
        message: 'Ich erinnere mich an den Tag eures Kennenlernens.',
        password: 'falsches-kennwort',
      })
    )
    expect(response.status).toBe(401)

    const getResponse = await GET(new Request('http://localhost/api/memories'))
    const body = await getResponse.json()
    expect(body.entries).toHaveLength(0)
  })

  it('POST with the correct password accepts case and spaces and sets a session cookie', async () => {
    const response = await POST(
      postRequest({
        name: 'Anna',
        message: 'Ich erinnere mich an den Tag eures Kennenlernens.',
        password: ' EMPFANG-secret ',
      })
    )
    expect(response.status).toBe(201)
    expect(response.headers.get('set-cookie')).toContain(`${GALLERY_COOKIE_NAME}=`)
  })

  it('POST with a valid session cookie needs no password in the body', async () => {
    const cookieValue = createGallerySessionCookieValue(getDb())
    const response = await POST(
      new Request('http://localhost/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: `${GALLERY_COOKIE_NAME}=${cookieValue}` },
        body: JSON.stringify({ name: 'Anna', message: 'Ich erinnere mich an den Tag eures Kennenlernens.' }),
      })
    )
    expect(response.status).toBe(201)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('POST rejects a missing password', async () => {
    const response = await POST(
      postRequest({ name: 'Anna', message: 'Ich erinnere mich an den Tag eures Kennenlernens.' })
    )
    expect(response.status).toBe(401)
  })

  it('POST rejects a message shorter than 10 characters even with a correct password', async () => {
    const response = await POST(
      postRequest({ name: 'Anna', message: 'Kurz', password: 'empfang-secret' })
    )
    expect(response.status).toBe(400)
  })

  // Auf der Feier teilen sich viele Gäste eine Adresse: gezählt wird je Gerät.
  it('lets many devices behind one address share memories, each within its own allowance', async () => {
    const db = getDb()
    const base = Date.now()
    for (let device = 0; device < 40; device++) {
      const session = createGallerySessionCookieValue(db, base + device)
      for (let i = 0; i < 3; i++) {
        const response = await POST(
          new Request('http://localhost/api/memories', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: `${GALLERY_COOKIE_NAME}=${session}`,
              'x-forwarded-for': '203.0.113.60',
            },
            body: JSON.stringify({ name: 'Gast ' + device, message: 'Eine gültige Erinnerung hier drin.' }),
          })
        )
        expect(response.status).toBe(201)
      }
    }
  })

  it('stops a single device after 20 entries in 15 minutes, not the others', async () => {
    const db = getDb()
    const base = Date.now()
    const noisy = createGallerySessionCookieValue(db, base + 1_000)
    const quiet = createGallerySessionCookieValue(db, base + 2_000)
    const write = (session: string) =>
      POST(
        new Request('http://localhost/api/memories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: `${GALLERY_COOKIE_NAME}=${session}`,
            'x-forwarded-for': '203.0.113.61',
          },
          body: JSON.stringify({ name: 'Anna', message: 'Eine gültige Erinnerung hier drin.' }),
        })
      )

    for (let i = 0; i < 20; i++) expect((await write(noisy)).status).toBe(201)
    expect((await write(noisy)).status).toBe(429)
    expect((await write(quiet)).status).toBe(201)
  })

  it('is not filled up by requests that do not carry the password', async () => {
    getDb()
    const send = (password?: string) =>
      POST(
        new Request('http://localhost/api/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.71' },
          body: JSON.stringify({ name: 'Anna', message: 'Eine gültige Erinnerung hier drin.', ...(password ? { password } : {}) }),
        })
      )

    for (let i = 0; i < 260; i++) await send(i % 2 ? 'falsch' : undefined)

    expect((await send('empfang-secret')).status).toBe(201)
  })

  it('does not turn away the right password after many wrong ones from the same address', async () => {
    getDb()
    const send = (password: string) =>
      POST(
        new Request('http://localhost/api/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.62' },
          body: JSON.stringify({ name: 'Anna', message: 'Eine gültige Erinnerung hier drin.', password }),
        })
      )

    let last = 0
    for (let i = 0; i < 25; i++) last = (await send('falsch')).status
    expect(last).toBe(429)

    expect((await send('empfang-secret')).status).toBe(201)
  })

  it('rejects a new entry with 423 while memories writes are locked, but GET still works', async () => {
    setFeatureLocked(getDb(), 'memories', true)

    const response = await POST(
      postRequest({
        name: 'Anna',
        message: 'Eine Erinnerung während der Sperre.',
        password: 'empfang-secret',
      })
    )
    expect(response.status).toBe(423)

    const getResponse = await GET(new Request('http://localhost/api/memories'))
    expect(getResponse.status).toBe(200)
  })

  it('locking guestbook or who_votes does not block memories', async () => {
    setFeatureLocked(getDb(), 'guestbook', true)
    setFeatureLocked(getDb(), 'who_votes', true)

    const response = await POST(
      postRequest({
        name: 'Anna',
        message: 'Erinnerungen bleiben offen.',
        password: 'empfang-secret',
      })
    )
    expect(response.status).toBe(201)
  })

  describe('with a photo', () => {
    function postWithTicket(extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Request {
      return new Request('http://localhost/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          name: 'Anna',
          message: 'Mit einem Foto von damals, lang genug.',
          password: 'empfang-secret',
          ticket: signedTicket(),
          ...extra,
        }),
      })
    }

    it('stores the entry and a gallery photo together and returns the delete token', async () => {
      objectsExist()
      const response = await POST(postWithTicket())

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.entry.photo).toEqual({
        id: 'photo-1',
        thumbUrl: 'https://fotos.example.de/gallery/photo-1/thumb.jpg',
        originalUrl: 'https://fotos.example.de/gallery/photo-1/original.jpg',
      })
      expect(body.deleteToken).toMatch(/^[0-9a-f]{64}$/)

      const photos = listGalleryPhotos(getDb())
      expect(photos).toHaveLength(1)
      expect(photos[0]).toMatchObject({ id: 'photo-1', uploaderName: 'Anna', category: 'Erinnerungen' })
    })

    it('shows the photo to an unlocked browser and only hints at it to a locked one', async () => {
      objectsExist()
      await POST(postWithTicket())

      const locked = await (await GET(new Request('http://localhost/api/memories'))).json()
      expect(locked.entries[0].photo).toBeNull()
      expect(locked.entries[0].hasPhoto).toBe(true)

      const cookieValue = createGallerySessionCookieValue(getDb())
      const unlocked = await (
        await GET(
          new Request('http://localhost/api/memories', {
            headers: { cookie: `${GALLERY_COOKIE_NAME}=${cookieValue}` },
          })
        )
      ).json()
      expect(unlocked.entries[0].photo.thumbUrl).toContain('/gallery/photo-1/thumb.jpg')
    })

    it('never puts storage keys into the response', async () => {
      objectsExist()
      await POST(postWithTicket())
      const cookieValue = createGallerySessionCookieValue(getDb())
      const response = await GET(
        new Request('http://localhost/api/memories', { headers: { cookie: `${GALLERY_COOKIE_NAME}=${cookieValue}` } })
      )
      const text = await response.text()
      expect(text).not.toContain('thumbKey')
      expect(text).not.toContain('thumb_key')
    })

    it('reports whether photos can currently be attached', async () => {
      const get = async () => (await (await GET(new Request('http://localhost/api/memories'))).json()).photosEnabled
      expect(await get()).toBe(true)

      setFeatureLocked(getDb(), 'memory_photos', true)
      expect(await get()).toBe(false)

      setFeatureLocked(getDb(), 'memory_photos', false)
      setFeatureLocked(getDb(), 'gallery_upload', true)
      expect(await get()).toBe(false)
    })

    it('rejects a photo with 423 while memory photos are locked, but still accepts text', async () => {
      setFeatureLocked(getDb(), 'memory_photos', true)
      const withPhoto = await POST(postWithTicket())
      expect(withPhoto.status).toBe(423)
      expect(mockHeadObject).not.toHaveBeenCalled()

      const textOnly = await POST(
        postRequest({ name: 'Anna', message: 'Nur Text bleibt möglich, lang genug.', password: 'empfang-secret' })
      )
      expect(textOnly.status).toBe(201)
    })

    it('rejects a photo with 423 while gallery uploads are paused', async () => {
      setFeatureLocked(getDb(), 'gallery_upload', true)
      expect((await POST(postWithTicket())).status).toBe(423)
    })

    it('checks the password before it looks at the ticket', async () => {
      const response = await POST(postWithTicket({ password: 'falsch' }))
      expect(response.status).toBe(401)
      expect(mockHeadObject).not.toHaveBeenCalled()
    })

    it('rejects an invalid or expired ticket and stores nothing', async () => {
      expect((await POST(postWithTicket({ ticket: 'nope' }))).status).toBe(400)
      expect(
        (await POST(postWithTicket({ ticket: signedTicket({ expiresAt: Date.now() - 1000 }) }))).status
      ).toBe(400)

      expect(listMemoryEntriesCount()).toBe(0)
      expect(listGalleryPhotos(getDb())).toHaveLength(0)
    })

    it('only accepts tickets issued for the memories category', async () => {
      objectsExist()
      const response = await POST(postWithTicket({ ticket: signedTicket({ category: 'Standesamt' }) }))
      expect(response.status).toBe(400)
      expect(listMemoryEntriesCount()).toBe(0)
    })

    it('stores nothing when the uploaded objects are missing', async () => {
      mockHeadObject.mockResolvedValue(null)
      const response = await POST(postWithTicket())

      expect(response.status).toBe(400)
      expect(listMemoryEntriesCount()).toBe(0)
      expect(listGalleryPhotos(getDb())).toHaveLength(0)
    })

    it('answers 409 and stores no second entry when the same ticket is used twice', async () => {
      objectsExist()
      const ticket = signedTicket()
      expect((await POST(postWithTicket({ ticket }))).status).toBe(201)
      expect((await POST(postWithTicket({ ticket }))).status).toBe(409)
      expect(listMemoryEntriesCount()).toBe(1)
    })

    it('accepts the session cookie instead of a password', async () => {
      objectsExist()
      const cookieValue = createGallerySessionCookieValue(getDb())
      const response = await POST(
        postWithTicket({ password: undefined }, { cookie: `${GALLERY_COOKIE_NAME}=${cookieValue}` })
      )
      expect(response.status).toBe(201)
    })
  })

  describe('conditional requests (ETag)', () => {
    const get = (headers: Record<string, string> = {}) =>
      GET(new Request('http://localhost/api/memories', { headers }))
    const withTag = (etag: string, cookie?: string) =>
      get({ 'if-none-match': etag, ...(cookie ? { cookie } : {}) })
    const galleryPhoto = (id: string) => ({
      id,
      thumbKey: `gallery/${id}/thumb.jpg`,
      originalKey: `gallery/${id}/original.jpg`,
      uploaderName: 'Anna',
      deleteTokenHash: `h-${id}`,
      category: 'Erinnerungen',
      isOfficial: false,
    })

    it('answers 304 without a body when nothing changed', async () => {
      addMemoryEntry(getDb(), 'Anna', 'Ein Moment, den ich nie vergesse.', null)
      const etag = (await get()).headers.get('etag') as string

      const response = await withTag(etag)

      expect(response.status).toBe(304)
      expect(await response.text()).toBe('')
    })

    it('sends the list again after a new entry', async () => {
      addMemoryEntry(getDb(), 'Anna', 'Ein Moment, den ich nie vergesse.', null)
      const etag = (await get()).headers.get('etag') as string

      addMemoryEntry(getDb(), 'Ben', 'Ein Lachen, das bleibt für immer.', null)
      const response = await withTag(etag)

      expect(response.status).toBe(200)
      expect((await response.json()).entries).toHaveLength(2)
    })

    it('sends the list again when the photo of an entry was deleted from the gallery', async () => {
      addGalleryPhoto(getDb(), galleryPhoto('p1'))
      addMemoryEntry(getDb(), 'Anna', 'Ein Moment, den ich nie vergesse.', 'p1')
      const cookie = `${GALLERY_COOKIE_NAME}=${createGallerySessionCookieValue(getDb())}`
      const etag = (await get({ cookie })).headers.get('etag') as string

      deleteGalleryPhotoRow(getDb(), 'p1')
      const response = await withTag(etag, cookie)

      expect(response.status).toBe(200)
      expect((await response.json()).entries[0].hasPhoto).toBe(false)
    })

    it('does not give a locked browser the photos because it sends the ETag of an unlocked one', async () => {
      addGalleryPhoto(getDb(), galleryPhoto('p1'))
      addMemoryEntry(getDb(), 'Anna', 'Ein Moment, den ich nie vergesse.', 'p1')
      const cookie = `${GALLERY_COOKIE_NAME}=${createGallerySessionCookieValue(getDb())}`
      const unlockedTag = (await get({ cookie })).headers.get('etag') as string

      const response = await withTag(unlockedTag)

      expect(response.status).toBe(200)
      expect((await response.json()).entries[0].photo).toBeNull()
    })

    it('sends the list again when photos get switched off for new entries', async () => {
      addMemoryEntry(getDb(), 'Anna', 'Ein Moment, den ich nie vergesse.', null)
      const etag = (await get()).headers.get('etag') as string

      setFeatureLocked(getDb(), 'memory_photos', true)
      const response = await withTag(etag)

      expect(response.status).toBe(200)
      expect((await response.json()).photosEnabled).toBe(false)
    })
  })
})
