import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, isValidSession } from '@/lib/admin-auth'
import { pageKeys, readSettings, writeSettings, type SiteSettings } from '@/lib/site-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function requireSession(request: NextRequest): boolean {
  return isValidSession(request.cookies.get(ADMIN_COOKIE_NAME)?.value)
}

export async function GET(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }
  const settings = await readSettings()
  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof body.pages !== 'object') {
    return NextResponse.json({ error: 'Ungültiges Format.' }, { status: 400 })
  }

  const current = await readSettings()
  const next: SiteSettings = { pages: { ...current.pages } }

  for (const key of pageKeys) {
    const incoming = body.pages[key]
    if (!incoming || typeof incoming !== 'object') continue
    next.pages[key] = {
      enabled: Boolean(incoming.enabled),
      revealAt: typeof incoming.revealAt === 'string' && incoming.revealAt ? incoming.revealAt : null,
    }
  }

  await writeSettings(next)
  return NextResponse.json(next)
}
