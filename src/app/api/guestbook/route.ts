import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { addGuestbookEntry, listGuestbookEntries } from '@/lib/guestbook'
import { isWritesLocked } from '@/lib/app-config'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'

const entrySchema = z.object({
  name: z.string().trim().min(1).max(60),
  message: z.string().trim().min(10).max(500),
})

const guestbookLimiter = new RateLimiter({
  // Deutlich höher als der Login-Limiter (5/15 Min): mehrere Gäste
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

  if (isWritesLocked(getDb())) {
    return NextResponse.json(
      { error: 'Neue Einträge sind derzeit vorübergehend gesperrt.' },
      { status: 423 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = entrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const entry = addGuestbookEntry(getDb(), parsed.data.name, parsed.data.message)
  return NextResponse.json({ entry }, { status: 201 })
}
