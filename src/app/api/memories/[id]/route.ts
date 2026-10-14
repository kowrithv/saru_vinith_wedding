import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { deleteMemoryEntry, getMemoryEntry } from '@/lib/memories'
import { isAdminRequest } from '@/lib/admin-auth'
import { removeGalleryPhoto } from '@/lib/gallery-photo-removal'

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

  const entry = getMemoryEntry(db, numericId)
  if (!entry) {
    return NextResponse.json({ error: 'Eintrag nicht gefunden.' }, { status: 404 })
  }

  // Das Foto zuerst: scheitert R2, bleibt der Eintrag stehen und der Admin
  // kann es erneut versuchen (statt einer Galerie-Waise ohne Erinnerung).
  if (entry.photo) {
    await removeGalleryPhoto(db, entry.photo)
  }
  deleteMemoryEntry(db, numericId)

  return NextResponse.json({ success: true })
}
