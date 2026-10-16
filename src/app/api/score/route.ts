import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { hasScoreAccess } from '@/lib/score-auth'
import { SCORE_TEAMS, changeScore, getScore, resetScore } from '@/lib/score'
import { publishScore } from '@/lib/score-hub'

const NO_STORE = { 'Cache-Control': 'no-store' }

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('change'), team: z.enum(SCORE_TEAMS), delta: z.union([z.literal(1), z.literal(-1)]) }),
  z.object({ action: z.literal('reset') }),
])

function unauthorized(): Response {
  return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401, headers: NO_STORE })
}

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  if (!hasScoreAccess(request, db)) return unauthorized()
  return NextResponse.json(getScore(db), { headers: NO_STORE })
}

export async function POST(request: Request): Promise<Response> {
  const db = getDb()
  if (!hasScoreAccess(request, db)) return unauthorized()

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400, headers: NO_STORE })
  }

  const score =
    parsed.data.action === 'reset' ? resetScore(db) : changeScore(db, parsed.data.team, parsed.data.delta)
  // Gespeichert ist es schon: jetzt sofort an Beamer und alle offenen Steuer-Seiten.
  publishScore(score)
  return NextResponse.json(score, { headers: NO_STORE })
}
