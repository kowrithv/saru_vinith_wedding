import { NextResponse } from 'next/server'
import { z } from 'zod'
import type Database from 'better-sqlite3'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { isFeatureLocked, setFeatureLocked, type LockableFeature } from '@/lib/app-config'

const FEATURES: LockableFeature[] = ['guestbook', 'memories', 'who_votes']

const bodySchema = z.object({
  feature: z.enum(['guestbook', 'memories', 'who_votes']),
  locked: z.boolean(),
})

function allLocks(db: Database.Database): Record<LockableFeature, boolean> {
  return Object.fromEntries(
    FEATURES.map((feature) => [feature, isFeatureLocked(db, feature)])
  ) as Record<LockableFeature, boolean>
}

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }
  return NextResponse.json({ locks: allLocks(db) })
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

  setFeatureLocked(db, parsed.data.feature, parsed.data.locked)
  return NextResponse.json({ locks: allLocks(db) })
}
