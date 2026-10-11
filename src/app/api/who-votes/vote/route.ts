import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { castVote } from '@/lib/who-votes'

const voteSchema = z.object({
  questionId: z.string().min(1).max(50),
  voterId: z.string().min(1).max(100),
  option: z.string().min(1).max(50),
})

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null)
  const parsed = voteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  try {
    const result = castVote(getDb(), parsed.data.questionId, parsed.data.voterId, parsed.data.option)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Unbekannte Frage oder Antwort.' }, { status: 400 })
  }
}
