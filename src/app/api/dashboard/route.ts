import { NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { todayStrBRT } from '@/lib/utils'

export async function GET() {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today = todayStrBRT()
    const todayStart = new Date(`${today}T00:00:00.000Z`)
    const todayEnd = new Date(`${today}T23:59:59.999Z`)
    const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`)

    const [totalClients, activeClients, openInvoices, overdueInvoices, todayLogs, monthLogs, settings] =
      await Promise.all([
        prisma.client.count({ where: { companyId } }),
        prisma.client.count({ where: { companyId, status: 'ativo' } }),
        prisma.invoice.count({ where: { companyId, status: 'aberta' } }),
        prisma.invoice.count({
          where: { companyId, status: { in: ['aberta', 'vencida'] }, dueDate: { lt: todayStart } },
        }),
        prisma.messageLog.count({ where: { companyId, sentAt: { gte: todayStart, lte: todayEnd } } }),
        prisma.messageLog.count({ where: { companyId, sentAt: { gte: monthStart } } }),
        prisma.companySettings.findUnique({ where: { companyId }, select: { erpType: true } }),
      ])

    return NextResponse.json({
      totalClients, activeClients, openInvoices, overdueInvoices, todayLogs, monthLogs,
      erpType: settings?.erpType || 'sgp',
    })
  } catch (err) {
    console.error('[GET /api/dashboard]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
