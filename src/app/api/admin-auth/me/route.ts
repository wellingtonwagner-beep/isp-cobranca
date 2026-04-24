import { NextResponse } from 'next/server'
import { getAdminSessionFromCookie } from '@/lib/admin-jwt'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getAdminSessionFromCookie()
  if (!session) return NextResponse.json({ admin: null }, { status: 401 })

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: { id: true, email: true, name: true, active: true, lastLoginAt: true },
  })
  if (!admin || !admin.active) {
    return NextResponse.json({ admin: null }, { status: 401 })
  }

  return NextResponse.json({ admin })
}
