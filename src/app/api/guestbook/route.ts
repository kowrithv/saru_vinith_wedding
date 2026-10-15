import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { addGuestbookEntry, listGuestbookEntries } from '@/lib/guestbook'
import { isFeatureLocked } from '@/lib/app-config'
import { setGallerySessionCookie } from '@/lib/gallery-auth'
import { GuestRateLimiter, gateGuest } from '@/lib/guest-limits'

const entrySchema = z.object({
  name: z.string().trim().min(1).max(60),
  message: z.string().trim().min(10).max(500),
})

// Gezählt wird je Gerät (Sitzung), nicht je Adresse: auf der Feier teilen sich
// viele Gäste das WLAN. Zwanzig Einträge in 15 Minuten sind für eine Person
// reichlich; ohne Sitzung (erster Eintrag mit Kennwort) gilt eine großzügige
// Grenze je Adresse.
const guestbookLimiter = new GuestRateLimiter({ perDevice: 20, perAddress: 200, windowMs: 15 * 60 * 1000 })

export async function GET(): Promise<Response> {
  const entries = listGuestbookEntries(getDb())
  return NextResponse.json({ entries })
}

export async function POST(request: Request): Promise<Response> {
  const db = getDb()
  const limit = guestbookLimiter.check(request, db)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Einträge. Bitte später erneut versuchen.' },
      { status: 429 }
    )
  }

  if (isFeatureLocked(db, 'guestbook')) {
    return NextResponse.json(
      { error: 'Neue Einträge sind derzeit vorübergehend gesperrt.' },
      { status: 423 }
    )
  }

  const body = await request.json().catch(() => null)

  // Kennwort (oder eine Sitzung daraus) zuerst prüfen, bevor auf Name und
  // Nachricht geschaut wird: ein falsches Kennwort verrät so nie, ob der
  // Rest gültig gewesen wäre.
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

  const entry = addGuestbookEntry(db, parsed.data.name, parsed.data.message)
  const response = NextResponse.json({ entry }, { status: 201 })
  // Mit dem Kennwort geschrieben: den Browser gleich für Galerie und
  // Erinnerungen entsperren.
  if (gate.issueSession) setGallerySessionCookie(response, db)
  return response
}
