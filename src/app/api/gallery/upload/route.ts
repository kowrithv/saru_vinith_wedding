import { NextRequest, NextResponse } from 'next/server'
import {
  MAX_FILES_PER_UPLOAD,
  MAX_UPLOAD_BYTES,
  extensionForMimeType,
  saveGalleryUploads,
} from '@/lib/gallery-uploads'
import { resolveCategoryFromPassword } from '@/lib/event-passwords'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const uploaderNameRaw = formData.get('uploaderName')
  const uploaderName = typeof uploaderNameRaw === 'string' ? uploaderNameRaw.trim().slice(0, 60) : ''
  const passwordRaw = formData.get('password')
  const password = typeof passwordRaw === 'string' ? passwordRaw : ''

  const files = formData.getAll('file').filter((f): f is File => f instanceof File)

  if (!uploaderName) {
    return NextResponse.json({ error: 'Bitte gib deinen Namen ein.' }, { status: 400 })
  }
  if (files.length === 0) {
    return NextResponse.json({ error: 'Bitte wähle mindestens ein Foto aus.' }, { status: 400 })
  }
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return NextResponse.json(
      { error: `Bitte lade maximal ${MAX_FILES_PER_UPLOAD} Fotos auf einmal hoch.` },
      { status: 400 }
    )
  }

  const category = resolveCategoryFromPassword(password)
  if (!category) {
    return NextResponse.json({ error: 'Falsches Kennwort.' }, { status: 401 })
  }

  for (const file of files) {
    if (!extensionForMimeType(file.type)) {
      return NextResponse.json(
        { error: `${file.name}: Nur JPG, PNG, WEBP oder GIF werden unterstützt.` },
        { status: 400 }
      )
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `${file.name}: Datei zu groß (max. ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB).` },
        { status: 400 }
      )
    }
  }

  const pendingFiles = await Promise.all(
    files.map(async (file) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    }))
  )

  const entries = await saveGalleryUploads(pendingFiles, uploaderName, category)

  return NextResponse.json(entries, { status: 201 })
}
