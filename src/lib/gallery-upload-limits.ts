// Gemeinsame Upload-Grenzen für Server (/api/uploads/request) und Browser
// (GalleryUploadForm), damit beide nicht auseinanderlaufen.

// Map statt Objekt-Literal: ein Objekt-Literal-Lookup ist für Werte wie
// "constructor" oder "toString" truthy (Object.prototype-Eigenschaften),
// obwohl das kein erlaubter Dateityp ist - eine Map hat dieses Problem
// nicht, da sie kein Prototype-Lookup für beliebige String-Keys macht.
export const IMAGE_CONTENT_TYPE_EXTENSIONS = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
])

export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024

const CONTENT_TYPE_BY_EXTENSION = new Map<string, string>([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['heic', 'image/heic'],
  ['heif', 'image/heif'],
])

/**
 * Manche Browser melden für HEIC-Dateien keinen MIME-Typ (leerer String).
 * Dann wird der Typ aus der Dateiendung abgeleitet; unbekannte Endungen
 * ergeben einen leeren String (= nicht erlaubt).
 */
export function resolveImageContentType(file: { name: string; type: string }): string {
  if (file.type) return file.type
  const dotIndex = file.name.lastIndexOf('.')
  if (dotIndex === -1) return ''
  const extension = file.name.slice(dotIndex + 1).toLowerCase()
  return CONTENT_TYPE_BY_EXTENSION.get(extension) ?? ''
}

export const UPLOADS_PAUSED_MESSAGE = 'Foto-Uploads sind derzeit pausiert.'
