import { promises as fs } from 'fs'
import path from 'path'
import { generateId } from '@/lib/utils'

export interface GalleryUpload {
  id: string
  src: string
  uploaderName: string
  category: string
  createdAt: string
}

const DATA_FILE = path.join(process.cwd(), 'data', 'gallery-uploads.json')
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'gallery')

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const MAX_FILES_PER_UPLOAD = 15
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function readGalleryUploads(): Promise<GalleryUpload[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeGalleryUploads(uploads: GalleryUpload[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(uploads, null, 2) + '\n', 'utf-8')
}

export function extensionForMimeType(mimeType: string): string | null {
  return ALLOWED_TYPES[mimeType] ?? null
}

interface PendingFile {
  buffer: Buffer
  mimeType: string
}

export async function saveGalleryUploads(
  files: PendingFile[],
  uploaderName: string,
  category: string
): Promise<GalleryUpload[]> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })

  const entries: GalleryUpload[] = []
  for (const file of files) {
    const extension = extensionForMimeType(file.mimeType)
    if (!extension) continue

    const id = generateId()
    const filename = `${id}.${extension}`
    await fs.writeFile(path.join(UPLOAD_DIR, filename), file.buffer)

    entries.push({
      id,
      src: `/uploads/gallery/${filename}`,
      uploaderName,
      category,
      createdAt: new Date().toISOString(),
    })
  }

  if (entries.length > 0) {
    const uploads = await readGalleryUploads()
    await writeGalleryUploads([...entries, ...uploads])
  }

  return entries
}
