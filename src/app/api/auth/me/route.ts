import { NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSessionFromCookie()
  if (!session) return NextResponse.json({ user: null })

  // Busca logo e plano separadamente (não ficam no JWT para não inflar o cookie)
  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { logo: true, plan: true },
  })

  return NextResponse.json({
    user: {
      ...session,
      logo: company?.logo ?? null,
      plan: company?.plan ?? 'lite',
      isSuperAdmin: !!process.env.SUPER_ADMIN_EMAIL && session.email === process.env.SUPER_ADMIN_EMAIL,
    },
  })
}
