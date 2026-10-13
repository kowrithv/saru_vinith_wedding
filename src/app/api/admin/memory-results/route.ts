import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { listMemoryResults } from '@/lib/memory-record'

/** Die besten gespeicherten Memory-Ergebnisse - nur für den Admin. */
export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }
  return NextResponse.json(listMemoryResults(db))
}
