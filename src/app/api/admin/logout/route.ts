import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME } from '../login/route'

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(ADMIN_COOKIE_NAME)
  return response
}
