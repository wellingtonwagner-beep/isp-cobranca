import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { todayStrBRT } from '@/lib/utils'

export async function GET() {
  try {
    const today = todayStrBRT()
    const todayStart = new Date(`${today}T00:00:00.000Z`)
    const todayEnd = new Date(`${today}T23:59:59.999Z`)

    const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`)

    const [
      totalClients,
      activeClients,
      openInvoices,
      overdueInvoices,
      todayLogs,
      monthLogs,
      lastSyncClient,
    ] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { status: 'ativo' } }),
      prisma.invoice.count({ where: { status: 'aberta' } }),
      prisma.invoice.count({ where: { status: { in: ['aberta', 'vencida'] }, dueDate: { lt: todayStart } } }),
      prisma.messageLog.findMany({
        where: { sentAt: { gte: todayStart, lte: todayEnd } },
        select: { stage: true, status: true },
      }),
      prisma.messageLog.findMany({
        where: { sentAt: { gte: monthStart } },
        select: { stage: true, status: true },
      }),
      prisma.client.findFirst({ orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } }),
    ])

    // Agrupa por stage
    const stageStats: Record<string, { sent: number; blocked: number }> = {}
    for (const log of monthLogs) {
      if (!stageStats[log.stage]) stageStats[log.stage] = { sent: 0, blocked: 0 }
      if (log.status === 'sent') stageStats[log.stage].sent++
      if (log.status === 'blocked_test') stageStats[log.stage].blocked++
    }

    const todaySent = todayLogs.filter((l) => l.status === 'sent').length
    const todayBlocked = todayLogs.filter((l) => l.status === 'blocked_test').length
    const todayFailed = todayLogs.filter((l) => l.status === 'failed').length

    return NextResponse.json({
      clients: { total: totalClients, active: activeClients },
      invoices: { open: openInvoices, overdue: overdueInvoices },
      today: { sent: todaySent, blocked: todayBlocked, failed: todayFailed },
      stageStats,
      lastSync: lastSyncClient?.syncedAt || null,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
