import type { GalleryPhoto } from './gallery-photos'

export interface GalleryPhotoView {
  id: string
  uploaderName: string
  category: string
  isOfficial: boolean
  createdAt: string
  thumbUrl: string
  originalUrl: string
}

export function toGalleryPhotoView(photo: GalleryPhoto): GalleryPhotoView {
  const base = process.env.R2_PUBLIC_BASE_URL ?? ''
  return {
    id: photo.id,
    uploaderName: photo.uploaderName,
    category: photo.category,
    isOfficial: photo.isOfficial,
    createdAt: photo.createdAt,
    thumbUrl: `${base}/${photo.thumbKey}`,
    originalUrl: `${base}/${photo.originalKey}`,
  }
}
