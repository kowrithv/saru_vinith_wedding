import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { addMemoryEntry, listMemoryEntries } from '@/lib/memories'
import { verifyPassword } from '@/lib/admin-auth'
import { isFeatureLocked } from '@/lib/app-config'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'

const entrySchema = z.object({
  name: z.string().trim().min(1).max(60),
  message: z.string().trim().min(10).max(500),
})

const memoriesLimiter = new RateLimiter({
  // Deutlich höher als der Login-Limiter (5/15 Min): mehrere Gäste
  // teilen sich am Empfang oft dieselbe IP (Venue-WLAN, Mobilfunk-NAT) -
  // ein niedriges Limit würde eine ganze Tischrunde nach wenigen echten
  // Einträgen aussperren.
  maxAttempts: 30,
  windowMs: 15 * 60 * 1000,
})

export async function GET(): Promise<Response> {
  const entries = listMemoryEntries(getDb())
  return NextResponse.json({ entries })
}

export async function POST(request: Request): Promise<Response> {
  const clientKey = getClientKey(request)
  const limit = memoriesLimiter.check(clientKey)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Einträge. Bitte später erneut versuchen.' },
      { status: 429 }
    )
  }

  if (isFeatureLocked(getDb(), 'memories')) {
    return NextResponse.json(
      { error: 'Neue Einträge sind derzeit vorübergehend gesperrt.' },
      { status: 423 }
    )
  }

  const body = await request.json().catch(() => null)

  // Kennwort zuerst prüfen, bevor überhaupt auf Name/Nachricht geschaut
  // wird - ein falsches ODER fehlendes Kennwort verrät so nie, ob der
  // Rest der Eingabe sonst gültig gewesen wäre. verifyPassword hasht
  // immer zuerst (wie beim Admin-Login), auch ein leerer Kandidat landet
  // im zeitkonstanten Vergleich fester Länge, kein Orakel über die Länge.
  const uploadPassword = process.env.UPLOAD_PASSWORD_EMPFANG
  const candidatePassword =
    body && typeof body === 'object' && typeof (body as Record<string, unknown>).password === 'string'
      ? ((body as Record<string, unknown>).password as string)
      : ''
  if (!uploadPassword || !verifyPassword(candidatePassword, uploadPassword)) {
    return NextResponse.json({ error: 'Falsches Kennwort.' }, { status: 401 })
  }

  const parsed = entrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const entry = addMemoryEntry(getDb(), parsed.data.name, parsed.data.message, null)
  return NextResponse.json({ entry }, { status: 201 })
}
