import type Database from 'better-sqlite3'
import { deleteObjects } from './r2'
import { deleteGalleryPhotoRow } from './gallery-photos'
import { purgeCache } from './cloudflare-purge'

/**
 * Entfernt ein Foto vollständig: R2-Objekte, Datenbankzeile, Cloudflare-Cache.
 * Der Cache-Purge ist best effort und verhindert nie das Löschen.
 */
export async function removeGalleryPhoto(
  db: Database.Database,
  photo: { id: string; thumbKey: string; originalKey: string }
): Promise<void> {
  await deleteObjects([photo.thumbKey, photo.originalKey])
  deleteGalleryPhotoRow(db, photo.id)

  const baseUrl = process.env.R2_PUBLIC_BASE_URL ?? ''
  await purgeCache([`${baseUrl}/${photo.thumbKey}`, `${baseUrl}/${photo.originalKey}`])
}
