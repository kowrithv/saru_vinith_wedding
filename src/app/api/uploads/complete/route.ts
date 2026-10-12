import { randomBytes, createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getOrCreateAdminSecret } from '@/lib/admin-auth'
import { verifyUploadTicket } from '@/lib/upload-ticket'
import { headObject } from '@/lib/r2'
import { addGalleryPhoto } from '@/lib/gallery-photos'
import { toGalleryPhotoView } from '@/lib/gallery-photo-view'
import { isFeatureLocked } from '@/lib/app-config'
import { UPLOADS_PAUSED_MESSAGE } from '@/lib/gallery-upload-limits'

const bodySchema = z.object({
  ticket: z.string().min(1),
  uploaderName: z.string().trim().min(1).max(60),
})

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const db = getDb()
  const secret = getOrCreateAdminSecret(db)
  const payload = verifyUploadTicket(parsed.data.ticket, secret)
  if (!payload) {
    return NextResponse.json({ error: 'Ticket ungültig oder abgelaufen.' }, { status: 400 })
  }

  // Tickets, die vor der Sperre ausgestellt wurden, gelten nicht mehr -
  // sonst liefen laufende Uploads nach dem "Notaus" noch bis zu 15 Minuten
  // weiter. Admin-Tickets (offizielle Fotos) bleiben davon unberührt.
  if (!payload.isOfficial && isFeatureLocked(db, 'gallery_upload')) {
    return NextResponse.json({ error: UPLOADS_PAUSED_MESSAGE }, { status: 423 })
  }

  const [thumbInfo, originalInfo] = await Promise.all([
    headObject(payload.thumbKey),
    headObject(payload.originalKey),
  ])

  if (!thumbInfo || thumbInfo.size > payload.thumbMaxSize) {
    return NextResponse.json({ error: 'Thumbnail fehlt oder ist zu groß.' }, { status: 400 })
  }
  if (!originalInfo || originalInfo.size !== payload.originalSize) {
    return NextResponse.json({ error: 'Original fehlt oder Größe stimmt nicht.' }, { status: 400 })
  }

  const deleteToken = randomBytes(32).toString('hex')
  const deleteTokenHash = createHash('sha256').update(deleteToken, 'utf8').digest('hex')

  const photo = addGalleryPhoto(db, {
    id: payload.photoId,
    thumbKey: payload.thumbKey,
    originalKey: payload.originalKey,
    uploaderName: parsed.data.uploaderName,
    deleteTokenHash,
    category: payload.category,
    isOfficial: payload.isOfficial,
  })

  return NextResponse.json({ photo: toGalleryPhotoView(photo), deleteToken }, { status: 201 })
}
