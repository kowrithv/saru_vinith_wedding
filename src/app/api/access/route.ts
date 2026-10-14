import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hasGuestAccess } from '@/lib/gallery-auth'

// Sagt dem Browser, ob er schon entsperrt ist (Gast-Sitzung oder Admin), damit
// Gästebuch, Erinnerungen und Galerie das Kennwortfeld nur zeigen, wenn es
// gebraucht wird. Die Antwort hängt vom Cookie ab und darf nie gecacht werden.
export async function GET(request: Request): Promise<Response> {
  const unlocked = hasGuestAccess(request, getDb())
  return NextResponse.json({ unlocked }, { headers: { 'Cache-Control': 'no-store' } })
}
