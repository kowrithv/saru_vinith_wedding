import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { getGalleryMode } from '@/lib/gallery-mode'
import { isFeatureLocked } from '@/lib/app-config'
import { isGalleryUnlocked } from '@/lib/gallery-auth'
import { galleryFingerprint, listGalleryPhotos } from '@/lib/gallery-photos'
import { toGalleryPhotoView } from '@/lib/gallery-photo-view'
import { etagFor, hasEtag, notModified } from '@/lib/etag'

// Sicherheitsgrenze für die Antwort; auf einer Feier mit 200 Gästen kommen
// einige Tausend Fotos zusammen, die Seite zeigt davon stückweise.
const MAX_PHOTOS = 10_000

// Die Antwort hängt vom Cookie ab und darf nie zwischengespeichert werden.
const CACHE_CONTROL = { 'Cache-Control': 'no-store' }

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  const mode = getGalleryMode(db)
  const uploadsLocked = isFeatureLocked(db, 'gallery_upload')

  const canSeePhotos = mode === 'public' || isAdminRequest(request, db) || isGalleryUnlocked(request, db)
  // Die offene Galerie fragt alle 30 Sekunden nach Neuem: ohne Änderung nur ein 304
  // (siehe etag.ts). Der ETag enthält auch, ob der Aufrufer die Liste sehen darf.
  const etag = etagFor(['gallery', mode, uploadsLocked, canSeePhotos, canSeePhotos ? galleryFingerprint(db) : ''])
  const headers = { ...CACHE_CONTROL, ETag: etag }

  if (hasEtag(request, etag)) return notModified(etag, CACHE_CONTROL)

  if (!canSeePhotos) {
    return NextResponse.json({ mode, unlocked: false, uploadsLocked, photos: null }, { headers })
  }

  return NextResponse.json(
    {
      mode,
      unlocked: true,
      uploadsLocked,
      photos: listGalleryPhotos(db, MAX_PHOTOS).map(toGalleryPhotoView),
    },
    { headers }
  )
}
