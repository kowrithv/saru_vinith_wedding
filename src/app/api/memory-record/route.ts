import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { RateLimiter } from '@/lib/rate-limit'
import { getClientKey } from '@/lib/client-ip'
import {
  getMemoryRecord,
  MAX_MOVES,
  MAX_SECONDS,
  MIN_MOVES,
  MIN_SECONDS,
  resetMemoryRecord,
  submitMemoryResult,
} from '@/lib/memory-record'

const resultSchema = z.object({
  moves: z.number().int().min(MIN_MOVES).max(MAX_MOVES),
  seconds: z.number().int().min(MIN_SECONDS).max(MAX_SECONDS),
})

// Ein Spiel dauert mindestens eine halbe Minute: 60 Meldungen je Adresse und
// 15 Minuten reichen auch für ein gemeinsames WLAN, bremsen aber Skripte.
const resultLimiter = new RateLimiter({ maxAttempts: 60, windowMs: 15 * 60 * 1000 })

export async function GET(): Promise<Response> {
  return NextResponse.json({ record: getMemoryRecord(getDb()) })
}

export async function POST(request: Request): Promise<Response> {
  const limit = resultLimiter.check(getClientKey(request))
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = resultSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  return NextResponse.json(submitMemoryResult(getDb(), parsed.data))
}

export async function DELETE(request: Request): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }
  resetMemoryRecord(db)
  return NextResponse.json({ record: null })
}
