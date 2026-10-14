import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getGuestPassword, verifyGuestPassword } from '@/lib/guest-password'
import { setGallerySessionCookie } from '@/lib/gallery-auth'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'

const bodySchema = z.object({ password: z.string().min(1).max(200) })

const unlockLimiter = new RateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 })

export async function POST(request: Request): Promise<Response> {
  const clientKey = getClientKey(request)
  const limit = unlockLimiter.check(clientKey)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Zu viele Versuche. Bitte später erneut versuchen.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const db = getDb()
  if (!verifyGuestPassword(parsed.data.password, getGuestPassword())) {
    return NextResponse.json({ error: 'Falsches Kennwort.' }, { status: 401 })
  }

  // Nur Fehlversuche sollen das Limit füllen: auf der Feier teilen sich
  // viele Gäste die IP des WLANs, und jede erfolgreiche Entsperrung würde
  // sonst das Kontingent für alle anderen aufbrauchen.
  unlockLimiter.reset(clientKey)

  const response = NextResponse.json({ success: true })
  setGallerySessionCookie(response, db)
  return response
}
