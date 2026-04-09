import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'

export async function GET() {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const configs = await prisma.config.findMany({ where: { companyId } })
    const map: Record<string, string> = {}
    for (const c of configs) map[c.key] = c.value
    return NextResponse.json(map)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    for (const [key, value] of Object.entries(body)) {
      await prisma.config.upsert({
        where: { companyId_key: { companyId, key } },
        update: { value: String(value) },
        create: { companyId, key, value: String(value) },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
