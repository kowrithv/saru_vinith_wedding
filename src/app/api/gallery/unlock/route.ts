import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { verifyPassword } from '@/lib/admin-auth'
import { createGallerySessionCookieValue, GALLERY_COOKIE_NAME, GALLERY_SESSION_DURATION_MS } from '@/lib/gallery-auth'
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
  const uploadPassword = process.env.UPLOAD_PASSWORD_EMPFANG
  if (!uploadPassword || !verifyPassword(parsed.data.password, uploadPassword)) {
    return NextResponse.json({ error: 'Falsches Kennwort.' }, { status: 401 })
  }

  const expiresAt = Date.now() + GALLERY_SESSION_DURATION_MS
  const cookieValue = createGallerySessionCookieValue(db)
  const response = NextResponse.json({ success: true })
  response.cookies.set(GALLERY_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  })
  return response
}
