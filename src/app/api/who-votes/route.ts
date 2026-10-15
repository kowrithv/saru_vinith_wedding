import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getTally } from '@/lib/who-votes'
import { getWhoPhase, resultsAccess } from '@/lib/who-results'

const NO_STORE = { 'Cache-Control': 'no-store' }

// Die Zwischenstände sind geheim, bis das Brautpaar die Auflösung freigibt: sie
// sehen nur die DJ-Seite (Wort im Header) und der Admin. `phase` sagt der Seite,
// in welchem Zustand die Abstimmung ist (voting, closed, released).
export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  const phase = getWhoPhase(db)
  const released = phase === 'released'
  const access = resultsAccess(request, db)

  if (released || access.kind === 'allowed') {
    return NextResponse.json({ phase, released, questions: getTally(db) }, { headers: NO_STORE })
  }

  if (access.kind === 'blocked') {
    return NextResponse.json(
      { error: 'Zu viele falsche Codes. Bitte in ein paar Minuten noch einmal versuchen.' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(access.retryAfterSeconds) } }
    )
  }

  return NextResponse.json({ phase, released, questions: null }, { headers: NO_STORE })
}
