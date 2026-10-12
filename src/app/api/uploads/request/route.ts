import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { verifyPassword, getOrCreateAdminSecret } from '@/lib/admin-auth'
import { createPresignedPutUrl } from '@/lib/r2'
import { signUploadTicket } from '@/lib/upload-ticket'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'

// Map statt Objekt-Literal: ein Objekt-Literal-Lookup ist für Werte wie
// "constructor" oder "toString" truthy (Object.prototype-Eigenschaften),
// obwohl das kein erlaubter Dateityp ist - eine Map hat dieses Problem
// nicht, da sie kein Prototype-Lookup für beliebige String-Keys macht.
const CONTENT_TYPE_EXTENSIONS = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
])

const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024
const MAX_THUMB_BYTES = 2 * 1024 * 1024
const TICKET_DURATION_MS = 15 * 60 * 1000

const fileSchema = z.object({
  filename: z.string().min(1).max(200),
  size: z.number().int().positive(),
  contentType: z.string(),
})

const bodySchema = z.object({
  password: z.string().min(1).max(200),
  files: z.array(fileSchema).min(1).max(20),
})

const uploadsLimiter = new RateLimiter({ maxAttempts: 30, windowMs: 15 * 60 * 1000 })

export async function POST(request: Request): Promise<Response> {
  const clientKey = getClientKey(request)
  const limit = uploadsLimiter.check(clientKey)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const db = getDb()
  const uploadPassword = process.env.UPLOAD_PASSWORD_EMPFANG
  if (!uploadPassword || !verifyPassword(parsed.data.password, uploadPassword)) {
    return NextResponse.json({ error: 'Falsches Kennwort.' }, { status: 401 })
  }

  for (const file of parsed.data.files) {
    if (!CONTENT_TYPE_EXTENSIONS.has(file.contentType)) {
      return NextResponse.json({ error: `Dateityp nicht erlaubt: ${file.contentType}` }, { status: 400 })
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      return NextResponse.json({ error: 'Foto ist zu groß (max. 20 MB).' }, { status: 400 })
    }
  }

  const secret = getOrCreateAdminSecret(db)
  const tickets = await Promise.all(
    parsed.data.files.map(async (file) => {
      const extension = CONTENT_TYPE_EXTENSIONS.get(file.contentType) as string
      const photoId = randomUUID()
      const thumbKey = `gallery/${photoId}/thumb.jpg`
      const originalKey = `gallery/${photoId}/original.${extension}`
      const expiresAt = Date.now() + TICKET_DURATION_MS

      const [thumbPutUrl, originalPutUrl] = await Promise.all([
        // Kein signiertes ContentLength für das Thumbnail: seine Größe
        // steht erst nach der Browser-seitigen Kompression fest. Die
        // tatsächliche Größe wird in /api/uploads/complete per HeadObject
        // gegen MAX_THUMB_BYTES geprüft.
        createPresignedPutUrl(thumbKey, 'image/jpeg'),
        createPresignedPutUrl(originalKey, file.contentType, file.size),
      ])

      const ticket = signUploadTicket(
        { photoId, thumbKey, originalKey, thumbMaxSize: MAX_THUMB_BYTES, originalSize: file.size, expiresAt },
        secret
      )

      return { photoId, thumbKey, originalKey, thumbPutUrl, originalPutUrl, ticket, expiresAt }
    })
  )

  return NextResponse.json({ tickets })
}
