import { NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/jwt'

export async function GET() {
  const session = await getSessionFromCookie()
  if (!session) return NextResponse.json({ user: null })
  return NextResponse.json({ user: session })
}
