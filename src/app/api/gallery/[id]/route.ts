import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { getGalleryPhotoById, deleteGalleryPhotoRow } from '@/lib/gallery-photos'
import { deleteObjects } from '@/lib/r2'
import { purgeCache } from '@/lib/cloudflare-purge'

const bodySchema = z.object({ deleteToken: z.string().optional() })

function matchesToken(candidate: string, expectedHash: string): boolean {
  const candidateHash = createHash('sha256').update(candidate, 'utf8').digest('hex')
  const candidateBuffer = Buffer.from(candidateHash, 'hex')
  const expectedBuffer = Buffer.from(expectedHash, 'hex')
  if (candidateBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(candidateBuffer, expectedBuffer)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const db = getDb()
  const { id } = await params

  const photo = getGalleryPhotoById(db, id)
  if (!photo) {
    return NextResponse.json({ error: 'Foto nicht gefunden.' }, { status: 404 })
  }

  const isAdmin = isAdminRequest(request, db)
  if (!isAdmin) {
    const body = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    const candidate = parsed.success ? parsed.data.deleteToken : undefined
    if (!candidate || !matchesToken(candidate, photo.deleteTokenHash)) {
      return NextResponse.json({ error: 'Nicht berechtigt.' }, { status: 403 })
    }
  }

  await deleteObjects([photo.thumbKey, photo.originalKey])
  deleteGalleryPhotoRow(db, id)

  const baseUrl = process.env.R2_PUBLIC_BASE_URL ?? ''
  await purgeCache([`${baseUrl}/${photo.thumbKey}`, `${baseUrl}/${photo.originalKey}`])

  return NextResponse.json({ success: true })
}
