import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { addGuestbookEntry, listGuestbookEntries } from '@/lib/guestbook'
import { isFeatureLocked } from '@/lib/app-config'
import { authorizeGuest, setGallerySessionCookie } from '@/lib/gallery-auth'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'

const entrySchema = z.object({
  name: z.string().trim().min(1).max(60),
  message: z.string().trim().min(10).max(500),
})

const guestbookLimiter = new RateLimiter({
  // Deutlich höher als der Admin-Login-Limiter (5/15 Min): mehrere Gäste
  // teilen sich am Empfang oft dieselbe IP (Venue-WLAN, Mobilfunk-NAT) -
  // ein niedriges Limit würde eine ganze Tischrunde nach wenigen echten
  // Einträgen aussperren.
  maxAttempts: 30,
  windowMs: 15 * 60 * 1000,
})

export async function GET(): Promise<Response> {
  const entries = listGuestbookEntries(getDb())
  return NextResponse.json({ entries })
}

export async function POST(request: Request): Promise<Response> {
  const clientKey = getClientKey(request)
  const limit = guestbookLimiter.check(clientKey)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Einträge. Bitte später erneut versuchen.' },
      { status: 429 }
    )
  }

  if (isFeatureLocked(getDb(), 'guestbook')) {
    return NextResponse.json(
      { error: 'Neue Einträge sind derzeit vorübergehend gesperrt.' },
      { status: 423 }
    )
  }

  const body = await request.json().catch(() => null)

  // Kennwort (oder eine Sitzung daraus) zuerst prüfen, bevor auf Name und
  // Nachricht geschaut wird: ein falsches Kennwort verrät so nie, ob der
  // Rest gültig gewesen wäre.
  const db = getDb()
  const candidatePassword =
    body && typeof body === 'object' ? (body as Record<string, unknown>).password : undefined
  const access = authorizeGuest(request, db, candidatePassword)
  if (!access.ok) {
    return NextResponse.json({ error: 'Falsches Kennwort.' }, { status: 401 })
  }

  const parsed = entrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const entry = addGuestbookEntry(db, parsed.data.name, parsed.data.message)
  const response = NextResponse.json({ entry }, { status: 201 })
  // Mit dem Kennwort geschrieben: den Browser gleich für Galerie und
  // Erinnerungen entsperren.
  if (access.issueSession) setGallerySessionCookie(response, db)
  return response
}
