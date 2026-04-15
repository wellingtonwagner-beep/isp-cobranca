import { NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'

export async function GET() {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const [
      totalClients,
      newClientsThisMonth,
      newClientsLastMonth,
      totalOpenAmount,
      sentThisMonth,
      sentLastMonth,
      stageStats,
    ] = await Promise.all([
      prisma.client.count({ where: { companyId, status: 'ativo' } }),
      prisma.client.count({ where: { companyId, createdAt: { gte: thisMonthStart } } }),
      prisma.client.count({ where: { companyId, createdAt: { gte: lastMonthStart, lt: lastMonthEnd } } }),
      prisma.invoice.aggregate({
        where: { companyId, status: { in: ['aberta', 'vencida'] } },
        _sum: { amount: true },
      }),
      prisma.messageLog.count({ where: { companyId, sentAt: { gte: thisMonthStart }, status: 'sent' } }),
      prisma.messageLog.count({
        where: { companyId, sentAt: { gte: lastMonthStart, lt: lastMonthEnd }, status: 'sent' },
      }),
      prisma.messageLog.groupBy({
        by: ['stage'],
        where: { companyId, sentAt: { gte: thisMonthStart } },
        _count: { stage: true },
      }),
    ])

    const openAmount = totalOpenAmount._sum.amount || 0

    return NextResponse.json({
      totalClients,
      newClientsThisMonth,
      newClientsLastMonth,
      totalOpenAmount: openAmount,
      totalOpenAmountFormatted: formatCurrency(openAmount),
      sentThisMonth,
      sentLastMonth,
      stageStats,
    })
  } catch (err) {
    console.error('[GET /api/growth]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
