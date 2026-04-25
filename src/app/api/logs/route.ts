import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'

export async function GET(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = req.nextUrl
    const stage = searchParams.get('stage') || ''
    const status = searchParams.get('status') || ''
    const clientId = searchParams.get('clientId') || ''
    const date = searchParams.get('date') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = 10

    const where: Record<string, unknown> = { companyId }
    if (stage) where.stage = stage
    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (date) {
      where.sentAt = {
        gte: new Date(`${date}T00:00:00.000Z`),
        lt: new Date(`${date}T23:59:59.999Z`),
      }
    }

    const [logs, total] = await Promise.all([
      prisma.messageLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { sentAt: 'desc' },
        include: {
          client: { select: { name: true, whatsapp: true } },
          invoice: { select: { amount: true, dueDate: true } },
        },
      }),
      prisma.messageLog.count({ where }),
    ])

    return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
