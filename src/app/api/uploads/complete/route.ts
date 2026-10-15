import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getOrCreateAdminSecret } from '@/lib/admin-auth'
import { verifyUploadTicket } from '@/lib/upload-ticket'
import { checkUploadedObjects, isTicketAlreadyUsed, storeUploadedPhoto } from '@/lib/gallery-upload-complete'
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

  // Eine Wiederholung kostet keine R2-Abfragen: zuerst die Datenbank fragen.
  if (isTicketAlreadyUsed(db, payload)) {
    return NextResponse.json({ error: 'Dieses Foto wurde schon gespeichert.' }, { status: 409 })
  }

  const check = await checkUploadedObjects(payload)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const stored = storeUploadedPhoto(db, payload, parsed.data.uploaderName)
  if (!stored.ok) {
    return NextResponse.json({ error: stored.error }, { status: stored.status })
  }

  return NextResponse.json(
    { photo: toGalleryPhotoView(stored.photo), deleteToken: stored.deleteToken },
    { status: 201 }
  )
}
