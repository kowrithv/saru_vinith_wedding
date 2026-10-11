import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getTally } from '@/lib/who-votes'

export async function GET(): Promise<Response> {
  const tally = getTally(getDb())
  return NextResponse.json({ questions: tally })
}
