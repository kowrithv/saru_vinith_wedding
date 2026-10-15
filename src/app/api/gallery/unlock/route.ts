import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getGuestPassword, verifyGuestPassword } from '@/lib/guest-password'
import { setGallerySessionCookie } from '@/lib/gallery-auth'
import { registerWrongPassword } from '@/lib/guest-limits'

const bodySchema = z.object({ password: z.string().min(1).max(200) })

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const db = getDb()
  // Ein richtiges Kennwort kommt immer durch, auch von einer Adresse mit vielen
  // Fehlversuchen: auf der Feier teilen sich viele Gäste das WLAN, und niemand
  // soll am QR-Code scheitern. Gezählt werden nur falsche (siehe guest-limits.ts).
  if (!verifyGuestPassword(parsed.data.password, getGuestPassword())) {
    const wrong = registerWrongPassword(request)
    return NextResponse.json(
      { error: wrong.error },
      {
        status: wrong.status,
        ...(wrong.status === 429 ? { headers: { 'Retry-After': String(wrong.retryAfterSeconds) } } : {}),
      }
    )
  }

  const response = NextResponse.json({ success: true })
  setGallerySessionCookie(response, db)
  return response
}
