import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getOrCreateAdminSecret, isAdminRequest } from '@/lib/admin-auth'
import { setGallerySessionCookie } from '@/lib/gallery-auth'
import { createPresignedPutUrl } from '@/lib/r2'
import { signUploadTicket } from '@/lib/upload-ticket'
import { GuestRateLimiter, gateGuest } from '@/lib/guest-limits'
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

// Fotos je Gerät (Sitzung) und Stunde, nicht je Adresse: auf der Feier laden
// viele Gäste über dasselbe WLAN hoch. 300 Fotos sind für eine Person reichlich
// und halten ein außer Kontrolle geratenes Gerät auf; ohne Sitzung (erster
// Upload mit Kennwort) gilt eine großzügige Grenze je Adresse. Der Admin ist
// ausgenommen.
const uploadsLimiter = new GuestRateLimiter({ perDevice: 300, perAddress: 600, windowMs: 60 * 60 * 1000 })

export async function POST(request: Request): Promise<Response> {
  const db = getDb()
  const isOfficial = isAdminRequest(request, db)

  // Zuerst die Pause: Anfragen während der Pause dürfen kein Kontingent
  // verbrauchen, sonst wären Geräte nach dem Wieder-Freigeben gedrosselt.
  if (!isOfficial && isFeatureLocked(db, 'gallery_upload')) {
    return NextResponse.json({ error: UPLOADS_PAUSED_MESSAGE }, { status: 423 })
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
  // isOfficial kommt allein aus der Admin-Sitzung. Ein richtiges Kennwort wird
  // nie abgewiesen; gezählt werden nur falsche (siehe guest-limits.ts).
  let issueSession = false
  if (!isOfficial) {
    const gate = gateGuest(request, db, parsed.data.password)
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.error },
        {
          status: gate.status,
          ...(gate.status === 429 ? { headers: { 'Retry-After': String(gate.retryAfterSeconds) } } : {}),
        }
      )
    }
    issueSession = gate.issueSession
  }

  for (const file of parsed.data.files) {
    if (!CONTENT_TYPE_EXTENSIONS.has(file.contentType)) {
      return NextResponse.json({ error: `Dateityp nicht erlaubt: ${file.contentType}` }, { status: 400 })
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      return NextResponse.json({ error: 'Foto ist zu groß (max. 20 MB).' }, { status: 400 })
    }
  }

  // Umfang je Gerät: gezählt werden die angefragten Fotos, erst nachdem alle
  // Angaben gültig sind (eine fehlerhafte Anfrage verbraucht nichts).
  if (!isOfficial) {
    const volume = uploadsLimiter.check(request, db, parsed.data.files.length)
    if (!volume.allowed) {
      return NextResponse.json(
        { error: 'Zu viele Fotos in kurzer Zeit. Bitte in einer Weile weitermachen.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(volume.retryAfterMs / 1000)) } }
      )
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
