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

// Viele Gäste teilen sich die IP des Veranstaltungs-WLANs, und jede Meldung ist
// nur eine winzige Transaktion. Das Limit ist deshalb großzügig: es soll nur
// Dauerfeuer eines einzelnen Skripts bremsen, nie ehrliche Rekorde verlieren
// (eine abgewiesene Meldung bemerkt der Gast nicht). 3000 in 15 Minuten sind
// gut drei Spiele je Sekunde und Adresse.
const resultLimiter = new RateLimiter({ maxAttempts: 3000, windowMs: 15 * 60 * 1000 })

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
