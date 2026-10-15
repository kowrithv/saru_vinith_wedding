import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getOrCreateAdminSecret, isAdminRequest } from '@/lib/admin-auth'
import { authorizeGuest, setGallerySessionCookie } from '@/lib/gallery-auth'
import { createPresignedPutUrl } from '@/lib/r2'
import { signUploadTicket } from '@/lib/upload-ticket'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'
import { galleryCategories, isCategoryAllowedForUpload } from '@/lib/gallery-categories'
import {
  IMAGE_CONTENT_TYPE_EXTENSIONS as CONTENT_TYPE_EXTENSIONS,
  MAX_ORIGINAL_BYTES,
  MAX_THUMB_BYTES,
  UPLOADS_PAUSED_MESSAGE,
} from '@/lib/gallery-upload-limits'
import { isFeatureLocked } from '@/lib/app-config'

const TICKET_DURATION_MS = 15 * 60 * 1000

const fileSchema = z.object({
  filename: z.string().min(1).max(200),
  size: z.number().int().positive(),
  contentType: z.string(),
  // Größe der Vorschau, die der Browser schon erzeugt hat: sie wird fest
  // signiert, ein größerer PUT wird von R2 abgelehnt.
  thumbSize: z.number().int().positive().max(MAX_THUMB_BYTES),
})

const bodySchema = z.object({
  password: z.string().min(1).max(200).optional(),
  category: z.enum(galleryCategories),
  files: z.array(fileSchema).min(1).max(20),
})

const uploadsLimiter = new RateLimiter({ maxAttempts: 30, windowMs: 15 * 60 * 1000 })

export async function POST(request: Request): Promise<Response> {
  const db = getDb()
  const isOfficial = isAdminRequest(request, db)

  // Vor dem Rate-Limiter: Anfragen während der Pause dürfen das Kontingent
  // nicht füllen, sonst wären alle am gemeinsamen WLAN nach dem Wieder-
  // Freigeben (auch der Admin) für bis zu 15 Minuten gesperrt.
  if (!isOfficial && isFeatureLocked(db, 'gallery_upload')) {
    return NextResponse.json({ error: UPLOADS_PAUSED_MESSAGE }, { status: 423 })
  }

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

  // Kennenlernen und Verlobung sind die Fotos des Brautpaars: auch per
  // direkter Anfrage wählen Gäste sie nicht.
  if (!isCategoryAllowedForUpload(parsed.data.category, isOfficial)) {
    return NextResponse.json({ error: 'Diese Kategorie kann nicht gewählt werden.' }, { status: 400 })
  }

  // Gäste: gültige Sitzung (QR-Link oder früher eingegebenes Kennwort) oder
  // das Kennwort im Request. Eine Gast-Sitzung macht niemanden zum Admin:
  // isOfficial kommt allein aus der Admin-Sitzung.
  let issueSession = false
  if (!isOfficial) {
    const access = authorizeGuest(request, db, parsed.data.password)
    if (!access.ok) {
      return NextResponse.json({ error: 'Falsches Kennwort.' }, { status: 401 })
    }
    issueSession = access.issueSession
  }

  // Das Limit soll Kennwort-Raten bremsen, nicht Gäste: viele teilen sich
  // die IP des Veranstaltungs-WLANs, und ein Upload fragt je Dreiergruppe
  // Fotos neue Tickets an. Gezählt werden daher nur Fehlversuche - ein
  // richtiges Kennwort (oder die Admin-Sitzung) setzt den Zähler zurück.
  uploadsLimiter.reset(clientKey)

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
        createPresignedPutUrl(thumbKey, 'image/jpeg', file.thumbSize),
        createPresignedPutUrl(originalKey, file.contentType, file.size),
      ])

      const ticket = signUploadTicket(
        {
          photoId,
          thumbKey,
          originalKey,
          thumbMaxSize: file.thumbSize,
          originalSize: file.size,
          expiresAt,
          category: parsed.data.category,
          isOfficial,
        },
        secret
      )

      return { photoId, thumbKey, originalKey, thumbPutUrl, originalPutUrl, ticket, expiresAt }
    })
  )

  const response = NextResponse.json({ tickets })
  if (issueSession) setGallerySessionCookie(response, db)
  return response
}
