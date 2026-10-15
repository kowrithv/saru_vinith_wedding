import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { getGalleryMode } from '@/lib/gallery-mode'
import { isFeatureLocked } from '@/lib/app-config'
import { isGalleryUnlocked } from '@/lib/gallery-auth'
import { listGalleryPhotos } from '@/lib/gallery-photos'
import { toGalleryPhotoView } from '@/lib/gallery-photo-view'

// Sicherheitsgrenze für die Antwort; auf einer Feier mit 200 Gästen kommen
// einige Tausend Fotos zusammen, die Seite zeigt davon stückweise.
const MAX_PHOTOS = 10_000

// Die Antwort hängt vom Cookie ab und darf nie zwischengespeichert werden.
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  const mode = getGalleryMode(db)
  const uploadsLocked = isFeatureLocked(db, 'gallery_upload')

  const canSeePhotos = mode === 'public' || isAdminRequest(request, db) || isGalleryUnlocked(request, db)
  if (!canSeePhotos) {
    return NextResponse.json({ mode, unlocked: false, uploadsLocked, photos: null }, { headers: NO_STORE })
  }

  return NextResponse.json(
    {
      mode,
      unlocked: true,
      uploadsLocked,
      photos: listGalleryPhotos(db, MAX_PHOTOS).map(toGalleryPhotoView),
    },
    { headers: NO_STORE }
  )
}
