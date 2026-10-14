import { createPlaceholderThumbnailBlob, createThumbnailBlob } from './gallery-thumbnail'
import { MAX_THUMB_BYTES } from './gallery-upload-limits'

export interface PreviewImage {
  blob: Blob
  isPlaceholder: boolean
}

/**
 * Die Vorschau eines Fotos (800 px) oder, wenn der Browser es nicht dekodieren
 * kann (z. B. HEIC außerhalb von Safari), eine neutrale Fläche: das Original
 * wird trotzdem hochgeladen.
 */
export async function createPreviewImage(file: File): Promise<PreviewImage> {
  try {
    const blob = await createThumbnailBlob(file)
    // Die Größe wird im Ticket fest signiert und der Server lehnt mehr als
    // MAX_THUMB_BYTES ab: ein ungewöhnlich großes Bild bekommt die neutrale
    // Fläche.
    if (blob.size > MAX_THUMB_BYTES) return { blob: await createPlaceholderThumbnailBlob(), isPlaceholder: true }
    return { blob, isPlaceholder: false }
  } catch {
    return { blob: await createPlaceholderThumbnailBlob(), isPlaceholder: true }
  }
}
