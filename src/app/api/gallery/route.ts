import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { getGalleryMode } from '@/lib/gallery-mode'
import { isFeatureLocked } from '@/lib/app-config'
import { isGalleryUnlocked } from '@/lib/gallery-auth'
import { listGalleryPhotos } from '@/lib/gallery-photos'
import { toGalleryPhotoView } from '@/lib/gallery-photo-view'

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  const mode = getGalleryMode(db)
  const uploadsLocked = isFeatureLocked(db, 'gallery_upload')

  const canSeePhotos = mode === 'public' || isAdminRequest(request, db) || isGalleryUnlocked(request, db)
  if (!canSeePhotos) {
    return NextResponse.json({ mode, unlocked: false, uploadsLocked, photos: null })
  }

  return NextResponse.json({
    mode,
    unlocked: true,
    uploadsLocked,
    photos: listGalleryPhotos(db).map(toGalleryPhotoView),
  })
}
