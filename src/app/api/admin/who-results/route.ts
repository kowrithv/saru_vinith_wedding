import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { WHO_PHASES, getWhoPhase, resultsKey, setWhoPhase } from '@/lib/who-results'
import { countVotes, resetVotes } from '@/lib/who-votes'

const bodySchema = z.object({ phase: z.enum(WHO_PHASES as [string, ...string[]]) })

const NO_STORE = { 'Cache-Control': 'no-store' }

function state(db: ReturnType<typeof getDb>) {
  // `key` ist das Wort, das der DJ auf /dj eingibt (oder als `#k=` im Link mitbringt).
  return { phase: getWhoPhase(db), key: resultsKey(db), ...countVotes(db) }
}

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }
  return NextResponse.json(state(db), { headers: NO_STORE })
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

  setWhoPhase(db, parsed.data.phase as (typeof WHO_PHASES)[number])
  return NextResponse.json(state(db), { headers: NO_STORE })
}

// Alle Stimmen löschen (z. B. die Testdaten vor der Feier). Nach der Freigabe
// nicht mehr: die Gäste sehen dann die Ergebnisse, und ein versehentlicher Druck
// würde sie vor aller Augen leeren. Erst auf "Beendet" oder "Abstimmen" zurück.
export async function DELETE(request: Request): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }
  if (getWhoPhase(db) === 'released') {
    return NextResponse.json(
      { error: 'Die Ergebnisse sind freigegeben. Bitte zuerst auf „Beendet“ oder „Abstimmen“ stellen.' },
      { status: 409, headers: NO_STORE }
    )
  }

  const deleted = resetVotes(db)
  return NextResponse.json({ ...state(db), deleted }, { headers: NO_STORE })
}
