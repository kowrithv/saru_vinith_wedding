import type { MemoryEntry } from './memories'

export interface MemoryPhotoView {
  id: string
  thumbUrl: string
  originalUrl: string
}

/** Was Browser zu sehen bekommen: URLs statt Schlüssel, Foto nur nach Entsperren. */
export interface MemoryEntryView {
  id: number
  name: string
  message: string
  createdAt: string
  /** Es gibt ein Foto, auch wenn es diesem Browser (noch) nicht gezeigt wird. */
  hasPhoto: boolean
  photo: MemoryPhotoView | null
}

export function toMemoryEntryView(entry: MemoryEntry, options: { showPhoto: boolean }): MemoryEntryView {
  const base = process.env.R2_PUBLIC_BASE_URL ?? ''
  return {
    id: entry.id,
    name: entry.name,
    message: entry.message,
    createdAt: entry.createdAt,
    hasPhoto: entry.photo !== null,
    photo:
      entry.photo && options.showPhoto
        ? {
            id: entry.photo.id,
            thumbUrl: `${base}/${entry.photo.thumbKey}`,
            originalUrl: `${base}/${entry.photo.originalKey}`,
          }
        : null,
  }
}
