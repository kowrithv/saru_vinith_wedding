import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { deleteMemoryResult, getMemoryRecord, listMemoryResults } from '@/lib/memory-record'

/** Entfernt ein einzelnes (z. B. unmögliches) Ergebnis - nur für den Admin. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { id } = await params
  if (!/^\d{1,15}$/.test(id)) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }
  if (!deleteMemoryResult(db, Number(id))) {
    return NextResponse.json({ error: 'Ergebnis nicht gefunden.' }, { status: 404 })
  }
  return NextResponse.json({ record: getMemoryRecord(db), total: listMemoryResults(db, 0).total })
}
