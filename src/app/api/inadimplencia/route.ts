import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'
import { todayStrBRT } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const today = todayStrBRT()
    const todayDate = new Date(`${today}T00:00:00.000Z`)

    const { searchParams } = req.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = 50

    const where = {
      companyId,
      status: { in: ['aberta', 'vencida'] as string[] },
      dueDate: { lt: todayDate },
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dueDate: 'asc' },
        include: {
          client: { select: { id: true, name: true, whatsapp: true, phone: true, status: true } },
          messageLogs: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: { stage: true, sentAt: true, status: true },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ])

    const result = invoices.map((inv) => {
      const due = new Date(inv.dueDate)
      const diffMs = todayDate.getTime() - due.getTime()
      const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      return { ...inv, daysOverdue }
    })

    return NextResponse.json({ invoices: result, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
