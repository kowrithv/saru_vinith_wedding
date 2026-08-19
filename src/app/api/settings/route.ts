import { NextResponse } from 'next/server'
import { getVisibilityMap } from '@/lib/site-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const visibility = await getVisibilityMap()
  return NextResponse.json(visibility)
}
