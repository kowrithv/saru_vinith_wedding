import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { getDb } from '@/lib/db'
import { setFeatureLocked } from '@/lib/app-config'
import { getOrCreateAdminSecret } from '@/lib/admin-auth'
import { signUploadTicket, type TicketPayload } from '@/lib/upload-ticket'

const mockHeadObject = vi.fn()
vi.mock('@/lib/r2', () => ({
  headObject: (key: string) => mockHeadObject(key),
}))

function completeRequest(body: unknown): Request {
  return new Request('http://localhost/api/uploads/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function validPayload(): TicketPayload {
  return {
    photoId: 'photo-1',
    thumbKey: 'gallery/photo-1/thumb.jpg',
    originalKey: 'gallery/photo-1/original.jpg',
    thumbMaxSize: 2 * 1024 * 1024,
    originalSize: 4_000_000,
    expiresAt: Date.now() + 60_000,
    category: 'Standesamt',
    isOfficial: false,
  }
}

describe('POST /api/uploads/complete', () => {
  const originalPath = process.env.DATABASE_PATH
  const originalR2Base = process.env.R2_PUBLIC_BASE_URL

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
    process.env.R2_PUBLIC_BASE_URL = 'https://fotos.example.de'
    mockHeadObject.mockReset()
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
    process.env.R2_PUBLIC_BASE_URL = originalR2Base
  })

  it('creates the photo and returns a one-time delete token when sizes match', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret)
    mockHeadObject.mockImplementation(async (key: string) =>
      key.includes('thumb') ? { size: 100_000 } : { size: 4_000_000 }
    )

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.photo.uploaderName).toBe('Anna')
    expect(typeof body.deleteToken).toBe('string')
    expect(body.deleteToken.length).toBeGreaterThan(10)
  })

  it('answers 409, not a server error, when the same ticket is completed twice', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret)
    mockHeadObject.mockImplementation(async (key: string) =>
      key.includes('thumb') ? { size: 100_000 } : { size: 4_000_000 }
    )

    expect((await POST(completeRequest({ ticket, uploaderName: 'Anna' }))).status).toBe(201)
    expect((await POST(completeRequest({ ticket, uploaderName: 'Anna' }))).status).toBe(409)
  })

  it('rejects when the real original size does not match the ticket', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret)
    mockHeadObject.mockImplementation(async (key: string) =>
      key.includes('thumb') ? { size: 100_000 } : { size: 999 }
    )

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
    expect(response.status).toBe(400)
  })

  it('rejects when the thumbnail exceeds its signed maximum', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret)
    mockHeadObject.mockImplementation(async (key: string) =>
      key.includes('thumb') ? { size: 5 * 1024 * 1024 } : { size: 4_000_000 }
    )

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
    expect(response.status).toBe(400)
  })

  it('rejects a tampered ticket without calling R2 at all', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret)
    const separatorIndex = ticket.indexOf('.')
    const encoded = ticket.slice(0, separatorIndex)
    const signature = ticket.slice(separatorIndex + 1)
    const tamperedEncoded = encoded.slice(0, -1) + (encoded.endsWith('A') ? 'B' : 'A')
    const tamperedTicket = `${tamperedEncoded}.${signature}`

    const response = await POST(completeRequest({ ticket: tamperedTicket, uploaderName: 'Anna' }))
    expect(response.status).toBe(400)
    expect(mockHeadObject).not.toHaveBeenCalled()
  })

  it('rejects when either object is missing from R2', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret)
    mockHeadObject.mockResolvedValue(null)

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
    expect(response.status).toBe(400)
  })

  it('persists the category and isOfficial flag from the ticket onto the created photo', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket({ ...validPayload(), category: 'Verlobung', isOfficial: true }, secret)
    mockHeadObject.mockImplementation(async (key: string) =>
      key.includes('thumb') ? { size: 100_000 } : { size: 4_000_000 }
    )

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
    const body = await response.json()
    expect(body.photo.category).toBe('Verlobung')
    expect(body.photo.isOfficial).toBe(true)
  })

  it('returns thumbUrl/originalUrl instead of raw storage keys', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    const ticket = signUploadTicket(validPayload(), secret)
    mockHeadObject.mockImplementation(async (key: string) =>
      key.includes('thumb') ? { size: 100_000 } : { size: 4_000_000 }
    )

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))
    const body = await response.json()
    expect(body.photo.thumbUrl).toContain('/gallery/photo-1/thumb.jpg')
    expect(body.photo.originalUrl).toContain('/gallery/photo-1/original.jpg')
    expect(body.photo).not.toHaveProperty('thumbKey')
    expect(body.photo).not.toHaveProperty('originalKey')
  })

  it('refuses to register a guest ticket with 423 once uploads are locked', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    setFeatureLocked(db, 'gallery_upload', true)
    const ticket = signUploadTicket(validPayload(), secret)
    mockHeadObject.mockResolvedValue({ size: 4_000_000 })

    const response = await POST(completeRequest({ ticket, uploaderName: 'Anna' }))

    expect(response.status).toBe(423)
    expect(mockHeadObject).not.toHaveBeenCalled()
  })

  it('still registers an admin ticket while uploads are locked', async () => {
    const db = getDb()
    const secret = getOrCreateAdminSecret(db)
    setFeatureLocked(db, 'gallery_upload', true)
    const ticket = signUploadTicket({ ...validPayload(), isOfficial: true }, secret)
    mockHeadObject.mockImplementation(async (key: string) =>
      key.includes('thumb') ? { size: 100_000 } : { size: 4_000_000 }
    )

    const response = await POST(completeRequest({ ticket, uploaderName: 'Saruga' }))

    expect(response.status).toBe(201)
  })
})
