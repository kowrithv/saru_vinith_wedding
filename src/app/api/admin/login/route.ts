import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_DURATION_MS,
  getOrCreateAdminSecret,
  signCookieValue,
  verifyPassword,
} from '@/lib/admin-auth'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'

const loginSchema = z.object({ password: z.string().min(1) })

const loginLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
})

export async function POST(request: Request): Promise<Response> {
  const clientKey = getClientKey(request)
  const limit = loginLimiter.check(clientKey)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Versuche. Bitte später erneut versuchen.' },
      { status: 429 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json(
      { error: 'Admin-Login ist nicht konfiguriert.' },
      { status: 500 }
    )
  }

  if (!verifyPassword(parsed.data.password, adminPassword)) {
    return NextResponse.json({ error: 'Falsches Passwort.' }, { status: 401 })
  }

  // Nur Fehlversuche sollen sperren: sonst sperren mehrere Geräte, ein
  // Smoke-Test oder Anmelden/Abmelden die Admin-Person über die gemeinsame
  // WLAN-IP aus - mitten im Notfall.
  loginLimiter.reset(clientKey)

  const secret = getOrCreateAdminSecret(getDb())
  const expiresAt = Date.now() + ADMIN_SESSION_DURATION_MS
  const cookieValue = signCookieValue(expiresAt, secret)

  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  })
  return response
}
