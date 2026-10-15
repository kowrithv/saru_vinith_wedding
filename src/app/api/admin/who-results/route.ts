import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { areResultsReleased, resultsKey, setResultsReleased } from '@/lib/who-results'

const bodySchema = z.object({ released: z.boolean() })

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }
  // Der Code, den der DJ auf /dj eingibt (oder als `#k=` im Link mitbringt).
  return NextResponse.json({ released: areResultsReleased(db), key: resultsKey(db) }, { headers: NO_STORE })
}

export async function POST(request: Request): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  setResultsReleased(db, parsed.data.released)
  return NextResponse.json({ released: areResultsReleased(db), key: resultsKey(db) }, { headers: NO_STORE })
}
