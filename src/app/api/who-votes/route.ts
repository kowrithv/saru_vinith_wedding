import { NextResponse } from 'next/server'
import { readPublicWhoGame } from '@/lib/who-game'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await readPublicWhoGame()
  return NextResponse.json(data)
}
