import { NextRequest, NextResponse } from 'next/server'
import {
  MAX_MEMORY_PHOTO_BYTES,
  MAX_MEMORY_VIDEO_BYTES,
  extensionForMimeType,
  saveMemoryFile,
} from '@/lib/memory-uploads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Bitte wähle eine Datei aus.' }, { status: 400 })
  }
  if (!extensionForMimeType(file.type)) {
    return NextResponse.json({ error: 'Nicht unterstütztes Dateiformat.' }, { status: 400 })
  }

  const isVideo = file.type.startsWith('video/')
  const maxBytes = isVideo ? MAX_MEMORY_VIDEO_BYTES : MAX_MEMORY_PHOTO_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `Datei zu groß (max. ${Math.round(maxBytes / (1024 * 1024))} MB).` },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const url = await saveMemoryFile(buffer, file.type)

  return NextResponse.json({ url }, { status: 201 })
}
