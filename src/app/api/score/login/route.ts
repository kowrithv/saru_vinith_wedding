import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'
import { isScoreConfigured, setScoreSessionCookie, verifyScorePassword } from '@/lib/score-auth'

const loginSchema = z.object({ password: z.string().min(1) })

// Wie beim Admin-Login: nur Fehlversuche zählen.
const loginLimiter = new RateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 })

export async function POST(request: Request): Promise<Response> {
  if (!isScoreConfigured()) {
    return NextResponse.json({ error: 'Die Punkteanzeige ist nicht eingerichtet.' }, { status: 503 })
  }

  const clientKey = getClientKey(request)
  const limit = loginLimiter.check(clientKey)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Zu viele Versuche. Bitte später erneut versuchen.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  if (!verifyScorePassword(parsed.data.password)) {
    return NextResponse.json({ error: 'Falsches Passwort.' }, { status: 401 })
  }

  loginLimiter.reset(clientKey)
  const response = NextResponse.json({ success: true })
  setScoreSessionCookie(response, getDb())
  return response
}
