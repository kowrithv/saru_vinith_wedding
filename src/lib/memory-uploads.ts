import { promises as fs } from 'fs'
import path from 'path'
import { generateId } from '@/lib/utils'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'memories')

export const MAX_MEMORY_PHOTO_BYTES = 8 * 1024 * 1024
export const MAX_MEMORY_VIDEO_BYTES = 30 * 1024 * 1024

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

export function extensionForMimeType(mimeType: string): string | null {
  return ALLOWED_TYPES[mimeType] ?? null
}

export async function saveMemoryFile(file: Buffer, mimeType: string): Promise<string> {
  const extension = extensionForMimeType(mimeType)
  if (!extension) {
    throw new Error('Nicht unterstütztes Dateiformat.')
  }

  const filename = `${generateId()}.${extension}`
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.writeFile(path.join(UPLOAD_DIR, filename), file)

  return `/uploads/memories/${filename}`
}
