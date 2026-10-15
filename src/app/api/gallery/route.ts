import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { getGalleryMode } from '@/lib/gallery-mode'
import { isFeatureLocked } from '@/lib/app-config'
import { isGalleryUnlocked } from '@/lib/gallery-auth'
import { galleryFingerprint, listGalleryPhotos } from '@/lib/gallery-photos'
import { toGalleryPhotoView } from '@/lib/gallery-photo-view'

// Sicherheitsgrenze für die Antwort; auf einer Feier mit 200 Gästen kommen
// einige Tausend Fotos zusammen, die Seite zeigt davon stückweise.
const MAX_PHOTOS = 10_000

// Die Antwort hängt vom Cookie ab und darf nie zwischengespeichert werden.
const CACHE_CONTROL = { 'Cache-Control': 'no-store' }

// Die offene Galerie fragt alle 30 Sekunden nach neuen Fotos. Ohne Änderung soll
// das fast nichts kosten: die Antwort trägt einen ETag, und kommt er unverändert
// zurück (If-None-Match), antwortet der Server mit 304 und ohne Liste. Der ETag
// enthält alles, wovon die Antwort abhängt (auch ob der Aufrufer entsperrt ist):
// ein gesperrter Browser kann sich mit einem fremden ETag keine Liste holen.
function etagFor(parts: (string | boolean)[]): string {
  const hash = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)
  return `"${hash}"`
}

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  const mode = getGalleryMode(db)
  const uploadsLocked = isFeatureLocked(db, 'gallery_upload')

  const canSeePhotos = mode === 'public' || isAdminRequest(request, db) || isGalleryUnlocked(request, db)
  const etag = etagFor([mode, uploadsLocked, canSeePhotos, canSeePhotos ? galleryFingerprint(db) : ''])
  const headers = { ...CACHE_CONTROL, ETag: etag }

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers })
  }

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
