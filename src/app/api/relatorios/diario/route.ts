/**
 * GET /api/relatorios/diario?date=YYYY-MM-DD
 * Retorna sumário e logs detalhados de um dia: entregues, falhas e motivos.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dateParam = req.nextUrl.searchParams.get('date')
    const date = dateParam || new Date().toISOString().slice(0, 10)

    const dayStart = new Date(`${date}T00:00:00.000Z`)
    const dayEnd = new Date(`${date}T23:59:59.999Z`)

    const logs = await prisma.messageLog.findMany({
      where: { companyId, sentAt: { gte: dayStart, lte: dayEnd } },
      orderBy: { sentAt: 'desc' },
      include: {
        client: { select: { name: true, whatsapp: true } },
        invoice: { select: { amount: true, dueDate: true } },
      },
    })

    const summary = {
      total: logs.length,
      sent: logs.filter((l) => l.status === 'sent').length,
      failed: logs.filter((l) => l.status === 'failed').length,
      blocked_test: logs.filter((l) => l.status === 'blocked_test').length,
      skipped_no_phone: logs.filter((l) => l.status === 'skipped_no_phone').length,
      skipped_paid: logs.filter((l) => l.status === 'skipped_paid').length,
      blocked_duplicate: logs.filter((l) => l.status === 'blocked_duplicate').length,
      blocked_window: logs.filter((l) => l.status === 'blocked_window').length,
      blocked_holiday: logs.filter((l) => l.status === 'blocked_holiday').length,
    }

    const reasonCounts: Record<string, number> = {}
    for (const log of logs) {
      if (log.status === 'failed' || log.status === 'skipped_no_phone' || log.status === 'blocked_duplicate') {
        const reason = log.errorMessage || mapReason(log.status)
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
      }
    }
    const failureReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)

    const failedLogs = logs.filter(
      (l) => l.status === 'failed' || l.status === 'skipped_no_phone' || l.status === 'blocked_duplicate',
    )

    return NextResponse.json({
      date,
      summary,
      failureReasons,
      logs,
      failedLogs,
    })
  } catch (err) {
    console.error('[GET /api/relatorios/diario]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function mapReason(status: string): string {
  switch (status) {
    case 'skipped_no_phone': return 'Cliente sem WhatsApp cadastrado'
    case 'blocked_duplicate': return 'Mensagem duplicada (já enviada)'
    default: return 'Erro desconhecido'
  }
}
