import { NextRequest, NextResponse } from 'next/server'
import { castVote } from '@/lib/who-game'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const questionId = typeof body?.questionId === 'string' ? body.questionId : ''
  const option = typeof body?.option === 'string' ? body.option : ''
  const voterName = typeof body?.voterName === 'string' ? body.voterName : ''

  if (!questionId || !option || !voterName.trim()) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  try {
    const data = await castVote(questionId, option, voterName)
    // Nur die aggregierten Ergebnisse zurückgeben – Namen anderer Gäste bleiben privat.
    return NextResponse.json({ questions: data.questions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stimme konnte nicht gespeichert werden.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
