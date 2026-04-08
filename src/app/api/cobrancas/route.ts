import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { todayStrBRT, addDaysBRT, dateToBRTString, parseDate } from '@/lib/utils'
import { STAGES } from '@/lib/templates'

export async function GET() {
  try {
    const today = todayStrBRT()
    const todayStart = new Date(`${today}T00:00:00.000Z`)
    const todayEnd = new Date(`${today}T23:59:59.999Z`)

    // Logs de hoje
    const todayLogs = await prisma.messageLog.findMany({
      where: { sentAt: { gte: todayStart, lte: todayEnd } },
      include: { client: { select: { name: true, whatsapp: true } }, invoice: { select: { amount: true, dueDate: true } } },
      orderBy: { sentAt: 'desc' },
    })

    const sent = todayLogs.filter((l) => l.status === 'sent').length
    const blocked = todayLogs.filter((l) => l.status === 'blocked_test').length
    const failed = todayLogs.filter((l) => l.status === 'failed').length

    // Calcula previstos para hoje (faturas que serão processadas em algum estágio)
    let planned = 0
    const stagePreview: { stage: string; label: string; count: number; targetDate: string }[] = []

    for (const stageConfig of STAGES) {
      const targetDate = addDaysBRT(parseDate(today), -stageConfig.dayOffset)
      const targetDateStr = dateToBRTString(targetDate)

      const count = await prisma.invoice.count({
        where: {
          dueDate: {
            gte: new Date(`${targetDateStr}T00:00:00.000Z`),
            lt: new Date(`${targetDateStr}T23:59:59.999Z`),
          },
          status: { not: 'paga' },
          messageLogs: { none: { stage: stageConfig.stage } },
        },
      })

      if (count > 0) {
        planned += count
        stagePreview.push({
          stage: stageConfig.stage,
          label: stageConfig.label,
          count,
          targetDate: targetDateStr,
        })
      }
    }

    // Últimos 7 dias de histórico
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    const recentLogs = await prisma.messageLog.findMany({
      where: { sentAt: { gte: sevenDaysAgo } },
      include: {
        client: { select: { name: true, whatsapp: true } },
        invoice: { select: { amount: true, dueDate: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({
      summary: { planned, sent, blocked, failed, pending: planned },
      stagePreview,
      todayLogs,
      recentLogs,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
