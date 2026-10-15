import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getTally } from '@/lib/who-votes'
import { areResultsReleased, canSeeResults } from '@/lib/who-results'

// Die Zwischenstände sind geheim, bis das Brautpaar die Auflösung freigibt: sie
// sehen nur der DJ-Link (Schlüssel im Header) und der Admin. `released` sagt
// der Seite, in welchem Zustand sie ist.
export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  const released = areResultsReleased(db)
  const visible = released || canSeeResults(request, db)
  return NextResponse.json(
    { released, questions: visible ? getTally(db) : null },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
