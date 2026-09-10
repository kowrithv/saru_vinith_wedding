import { NextRequest, NextResponse } from 'next/server'
import { addMemory, readMemories } from '@/lib/memories'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CONTENT_LENGTH = 2000
const MEDIA_URL_PREFIX = '/uploads/memories/'

export async function GET() {
  const memories = await readMemories()
  return NextResponse.json(memories)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''
  const type = body.type
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, MAX_CONTENT_LENGTH) : ''
  const mediaUrl = typeof body.mediaUrl === 'string' ? body.mediaUrl : undefined

  if (!name) {
    return NextResponse.json({ error: 'Bitte gib deinen Namen ein.' }, { status: 400 })
  }
  if (type !== 'text' && type !== 'photo' && type !== 'video') {
    return NextResponse.json({ error: 'Ungültiger Typ.' }, { status: 400 })
  }
  if (type === 'text' && !content) {
    return NextResponse.json({ error: 'Bitte schreib deine Erinnerung.' }, { status: 400 })
  }
  if ((type === 'photo' || type === 'video') && (!mediaUrl || !mediaUrl.startsWith(MEDIA_URL_PREFIX))) {
    return NextResponse.json({ error: 'Bitte wähle eine Datei aus.' }, { status: 400 })
  }

  const memory = await addMemory({ name, type, content, mediaUrl })
  return NextResponse.json(memory, { status: 201 })
}
