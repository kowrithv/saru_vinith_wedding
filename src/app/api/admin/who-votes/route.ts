import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, isValidSession } from '@/lib/admin-auth'
import { readWhoGame, setReveal } from '@/lib/who-game'
import { whoGameOptions } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function requireSession(request: NextRequest): boolean {
  return isValidSession(request.cookies.get(ADMIN_COOKIE_NAME)?.value)
}

export async function GET(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }
  const data = await readWhoGame()
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const questionId = typeof body?.questionId === 'string' ? body.questionId : ''
  const revealed = Boolean(body?.revealed)
  const correctAnswer =
    typeof body?.correctAnswer === 'string' && whoGameOptions.includes(body.correctAnswer)
      ? body.correctAnswer
      : null

  if (!questionId) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  try {
    const data = await setReveal(questionId, correctAnswer, revealed)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Speichern fehlgeschlagen.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
