import { NextResponse } from 'next/server'
import { readGalleryUploads } from '@/lib/gallery-uploads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const uploads = await readGalleryUploads()
  return NextResponse.json(uploads)
}
