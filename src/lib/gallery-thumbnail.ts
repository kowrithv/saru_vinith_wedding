const SAFE_INTERMEDIATE_MAX_DIMENSION = 4096
const THUMB_MAX_DIMENSION = 800
const THUMB_JPEG_QUALITY = 0.8

async function resizeBitmap(source: ImageBitmap, maxDimension: number): Promise<ImageBitmap> {
  if (source.width <= maxDimension && source.height <= maxDimension) {
    return source
  }
  const scale = maxDimension / Math.max(source.width, source.height)
  return createImageBitmap(source, {
    resizeWidth: Math.round(source.width * scale),
    resizeHeight: Math.round(source.height * scale),
    resizeQuality: 'high',
  })
}

export async function createThumbnailBlob(file: File): Promise<Blob> {
  const original = await createImageBitmap(file, { imageOrientation: 'from-image' })
  // Zweistufiges Downscaling gegen Mobile Safaris Canvas-Flächenlimit
  // (~16,7 Megapixel): zuerst auf eine sichere Zwischengröße, dann erst
  // auf die Ziel-Thumbnail-Größe.
  const intermediate = await resizeBitmap(original, SAFE_INTERMEDIATE_MAX_DIMENSION)
  if (intermediate !== original) original.close()
  const thumb = await resizeBitmap(intermediate, THUMB_MAX_DIMENSION)
  if (thumb !== intermediate) intermediate.close()

  const canvas = document.createElement('canvas')
  canvas.width = thumb.width
  canvas.height = thumb.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    thumb.close()
    throw new Error('Canvas-Kontext nicht verfügbar.')
  }
  ctx.drawImage(thumb, 0, 0)
  thumb.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Thumbnail-Erstellung fehlgeschlagen.'))),
      'image/jpeg',
      THUMB_JPEG_QUALITY
    )
  })
}
