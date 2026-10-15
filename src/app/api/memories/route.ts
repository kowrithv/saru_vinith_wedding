import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { addMemoryEntry, listMemoryEntries } from '@/lib/memories'
import { toMemoryEntryView } from '@/lib/memory-view'
import { getOrCreateAdminSecret } from '@/lib/admin-auth'
import { hasGuestAccess, setGallerySessionCookie } from '@/lib/gallery-auth'
import { isFeatureLocked } from '@/lib/app-config'
import { verifyUploadTicket, type TicketPayload } from '@/lib/upload-ticket'
import { checkUploadedObjects, storeUploadedPhoto } from '@/lib/gallery-upload-complete'
import { MEMORY_PHOTO_CATEGORY } from '@/lib/gallery-categories'
import { UPLOADS_PAUSED_MESSAGE } from '@/lib/gallery-upload-limits'
import { GuestRateLimiter, gateGuest } from '@/lib/guest-limits'

const entrySchema = z.object({
  name: z.string().trim().min(1).max(60),
  message: z.string().trim().min(10).max(500),
  // Upload-Ticket des Fotos (siehe /api/uploads/request, Kategorie "Erinnerungen").
  ticket: z.string().min(1).optional(),
})

// Gezählt wird je Gerät (Sitzung), nicht je Adresse: auf der Feier teilen sich
// viele Gäste das WLAN (siehe guest-limits.ts).
const memoriesLimiter = new GuestRateLimiter({ perDevice: 20, perAddress: 200, windowMs: 15 * 60 * 1000 })

function photosEnabled(db: ReturnType<typeof getDb>): boolean {
  return !isFeatureLocked(db, 'memory_photos') && !isFeatureLocked(db, 'gallery_upload')
}

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  // Fotos nur für entsperrte Browser (wie die Galerie); der Text bleibt offen.
  const showPhoto = hasGuestAccess(request, db)
  const entries = listMemoryEntries(db).map((entry) => toMemoryEntryView(entry, { showPhoto }))
  return NextResponse.json(
    { entries, photosEnabled: photosEnabled(db) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: Request): Promise<Response> {
  const db = getDb()
  const limit = memoriesLimiter.check(request, db)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Einträge. Bitte später erneut versuchen.' },
      { status: 429 }
    )
  }

  if (isFeatureLocked(db, 'memories')) {
    return NextResponse.json(
      { error: 'Neue Einträge sind derzeit vorübergehend gesperrt.' },
      { status: 423 }
    )
  }

  const body = await request.json().catch(() => null)

  // Kennwort (oder eine Sitzung daraus) zuerst prüfen, bevor überhaupt auf
  // Name/Nachricht geschaut wird - ein falsches ODER fehlendes Kennwort
  // verrät so nie, ob der Rest der Eingabe sonst gültig gewesen wäre. Der
  // Vergleich hasht immer zuerst (zeitkonstant, kein Orakel über die Länge).
  const candidatePassword =
    body && typeof body === 'object' ? (body as Record<string, unknown>).password : undefined
  const gate = gateGuest(request, db, candidatePassword)
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error },
      {
        status: gate.status,
        ...(gate.status === 429 ? { headers: { 'Retry-After': String(gate.retryAfterSeconds) } } : {}),
      }
    )
  }

  const parsed = entrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  // Mit Foto: Notaus-Schalter, dann Ticket und hochgeladene Objekte prüfen -
  // alles vor dem ersten Schreibvorgang.
  let ticket: TicketPayload | null = null
  if (parsed.data.ticket !== undefined) {
    if (!photosEnabled(db)) {
      return NextResponse.json({ error: UPLOADS_PAUSED_MESSAGE }, { status: 423 })
    }
    ticket = verifyUploadTicket(parsed.data.ticket, getOrCreateAdminSecret(db))
    // Ein Galerie-Ticket (andere Kategorie) ist kein Erinnerungs-Foto.
    if (!ticket || ticket.category !== MEMORY_PHOTO_CATEGORY) {
      return NextResponse.json({ error: 'Ticket ungültig oder abgelaufen.' }, { status: 400 })
    }
    const check = await checkUploadedObjects(ticket)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }
  }

  // Foto und Eintrag entstehen gemeinsam oder gar nicht.
  const { name, message } = parsed.data
  const write = db.transaction(() => {
    if (!ticket) {
      return { ok: true as const, entry: addMemoryEntry(db, name, message, null), deleteToken: undefined }
    }
    const stored = storeUploadedPhoto(db, ticket, name)
    if (!stored.ok) return stored
    return {
      ok: true as const,
      entry: addMemoryEntry(db, name, message, stored.photo.id),
      deleteToken: stored.deleteToken,
    }
  })
  const result = write()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const response = NextResponse.json(
    {
      entry: toMemoryEntryView(result.entry, { showPhoto: true }),
      ...(result.deleteToken ? { deleteToken: result.deleteToken } : {}),
    },
    { status: 201 }
  )
  if (gate.issueSession) setGallerySessionCookie(response, db)
  return response
}
