import { createHash, randomBytes } from 'node:crypto'
import type Database from 'better-sqlite3'
import { headObject } from './r2'
import { addGalleryPhoto, getGalleryPhotoById, type GalleryPhoto } from './gallery-photos'
import type { TicketPayload } from './upload-ticket'

// Gemeinsam für /api/uploads/complete (Galerie) und /api/memories (Foto zu
// einer Erinnerung): ein Ticket wird erst zu einem Foto, wenn beide Objekte
// in R2 liegen und ihre Größen zur Signatur passen.

export type UploadFailure = { ok: false; status: number; error: string }

/** Ein Ticket gilt nur einmal: gibt es das Foto schon, ist es eine Wiederholung. */
export function isTicketAlreadyUsed(db: Database.Database, payload: TicketPayload): boolean {
  return Boolean(getGalleryPhotoById(db, payload.photoId))
}

/** Prüft per HeadObject, dass Vorschau und Original hochgeladen wurden. */
export async function checkUploadedObjects(payload: TicketPayload): Promise<{ ok: true } | UploadFailure> {
  const [thumbInfo, originalInfo] = await Promise.all([
    headObject(payload.thumbKey),
    headObject(payload.originalKey),
  ])

  if (!thumbInfo || thumbInfo.size > payload.thumbMaxSize) {
    return { ok: false, status: 400, error: 'Thumbnail fehlt oder ist zu groß.' }
  }
  if (!originalInfo || originalInfo.size !== payload.originalSize) {
    return { ok: false, status: 400, error: 'Original fehlt oder Größe stimmt nicht.' }
  }
  return { ok: true }
}

/**
 * Legt das Galerie-Foto an (synchron, damit der Aufrufer es in einer
 * Transaktion mit weiteren Schreibvorgängen bündeln kann). Ein Ticket gilt nur
 * einmal: ein zweiter Versuch ergibt 409 statt eines Datenbankfehlers.
 */
export function storeUploadedPhoto(
  db: Database.Database,
  payload: TicketPayload,
  uploaderName: string
): { ok: true; photo: GalleryPhoto; deleteToken: string } | UploadFailure {
  if (getGalleryPhotoById(db, payload.photoId)) {
    return { ok: false, status: 409, error: 'Dieses Foto wurde schon gespeichert.' }
  }

  const deleteToken = randomBytes(32).toString('hex')
  const deleteTokenHash = createHash('sha256').update(deleteToken, 'utf8').digest('hex')

  const photo = addGalleryPhoto(db, {
    id: payload.photoId,
    thumbKey: payload.thumbKey,
    originalKey: payload.originalKey,
    uploaderName,
    deleteTokenHash,
    category: payload.category,
    isOfficial: payload.isOfficial,
  })
  return { ok: true, photo, deleteToken }
}
