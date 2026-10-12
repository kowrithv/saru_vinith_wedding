import type Database from 'better-sqlite3'

export interface GalleryPhoto {
  id: string
  thumbKey: string
  originalKey: string
  uploaderName: string
  category: string
  isOfficial: boolean
  createdAt: string
}

interface GalleryPhotoRow {
  id: string
  thumb_key: string
  original_key: string
  uploader_name: string
  delete_token_hash: string
  category: string
  is_official: number
  created_at: string
}

function toPhoto(row: GalleryPhotoRow): GalleryPhoto {
  return {
    id: row.id,
    thumbKey: row.thumb_key,
    originalKey: row.original_key,
    uploaderName: row.uploader_name,
    category: row.category,
    isOfficial: row.is_official === 1,
    createdAt: row.created_at,
  }
}

const SELECT_COLUMNS =
  'id, thumb_key, original_key, uploader_name, delete_token_hash, category, is_official, created_at'

export function addGalleryPhoto(
  db: Database.Database,
  photo: {
    id: string
    thumbKey: string
    originalKey: string
    uploaderName: string
    deleteTokenHash: string
    category: string
    isOfficial: boolean
  }
): GalleryPhoto {
  db.prepare(
    `INSERT INTO gallery_photos (id, thumb_key, original_key, uploader_name, delete_token_hash, category, is_official)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    photo.id,
    photo.thumbKey,
    photo.originalKey,
    photo.uploaderName,
    photo.deleteTokenHash,
    photo.category,
    photo.isOfficial ? 1 : 0
  )
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM gallery_photos WHERE id = ?`)
    .get(photo.id) as GalleryPhotoRow
  return toPhoto(row)
}

export function listGalleryPhotos(db: Database.Database): GalleryPhoto[] {
  // Sortierung nach `rowid`, nicht `created_at`: `id` ist eine UUID (keine
  // fortlaufende Zahl), zwei schnell aufeinanderfolgende Inserts können
  // denselben Millisekunden-Zeitstempel bekommen. `rowid` ist SQLites
  // interner, garantiert streng aufsteigender Zähler - verhindert
  // Flakiness bei der "neueste zuerst"-Reihenfolge.
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM gallery_photos ORDER BY rowid DESC`)
    .all() as GalleryPhotoRow[]
  return rows.map(toPhoto)
}

export function getGalleryPhotoById(
  db: Database.Database,
  id: string
): (GalleryPhoto & { deleteTokenHash: string }) | undefined {
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM gallery_photos WHERE id = ?`)
    .get(id) as GalleryPhotoRow | undefined
  if (!row) return undefined
  return { ...toPhoto(row), deleteTokenHash: row.delete_token_hash }
}

export function deleteGalleryPhotoRow(db: Database.Database, id: string): boolean {
  const result = db.prepare('DELETE FROM gallery_photos WHERE id = ?').run(id)
  return result.changes > 0
}
