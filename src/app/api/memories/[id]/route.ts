import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { deleteMemoryEntry } from '@/lib/memories'
import { isAdminRequest } from '@/lib/admin-auth'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const db = getDb()
  if (!isAdminRequest(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 })
  }

  const deleted = deleteMemoryEntry(db, numericId)
  if (!deleted) {
    return NextResponse.json({ error: 'Eintrag nicht gefunden.' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
