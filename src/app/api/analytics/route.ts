import { NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'

export async function GET() {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()

    const months: { label: string; start: Date; end: Date }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
      const label = start.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      months.push({ label, start, end })
    }

    const [
      overdueByMonth,
      messagesByMonth,
      paidAfterMessageByMonth,
      stageSuccessRaw,
      clientStatusCounts,
      totalRecovered,
      totalOpen,
    ] = await Promise.all([
      // Inadimplência por mês (faturas vencidas em cada mês)
      Promise.all(
        months.map(async (m) => {
          const count = await prisma.invoice.count({
            where: {
              companyId,
              status: { in: ['aberta', 'vencida'] },
              dueDate: { gte: m.start, lte: m.end },
            },
          })
          const amount = await prisma.invoice.aggregate({
            where: {
              companyId,
              status: { in: ['aberta', 'vencida'] },
              dueDate: { gte: m.start, lte: m.end },
            },
            _sum: { amount: true },
          })
          return { month: m.label, count, amount: amount._sum.amount || 0 }
        }),
      ),

      // Mensagens enviadas por mês
      Promise.all(
        months.map(async (m) => {
          const sent = await prisma.messageLog.count({
            where: { companyId, status: 'sent', sentAt: { gte: m.start, lte: m.end } },
          })
          const failed = await prisma.messageLog.count({
            where: { companyId, status: { not: 'sent' }, sentAt: { gte: m.start, lte: m.end } },
          })
          return { month: m.label, enviadas: sent, falhas: failed }
        }),
      ),

      // Faturas pagas que tiveram mensagem de cobrança (recuperação) por mês
      Promise.all(
        months.map(async (m) => {
          const recovered = await prisma.invoice.count({
            where: {
              companyId,
              status: 'paga',
              updatedAt: { gte: m.start, lte: m.end },
              messageLogs: { some: { status: 'sent' } },
            },
          })
          const recoveredAmount = await prisma.invoice.aggregate({
            where: {
              companyId,
              status: 'paga',
              updatedAt: { gte: m.start, lte: m.end },
              messageLogs: { some: { status: 'sent' } },
            },
            _sum: { amount: true },
          })
          return { month: m.label, count: recovered, amount: recoveredAmount._sum.amount || 0 }
        }),
      ),

      // Taxa de sucesso por estágio: faturas que foram pagas após receber mensagem em cada estágio
      prisma.$queryRaw<{ stage: string; total: number; paid: number }[]>`
        SELECT
          ml.stage,
          COUNT(DISTINCT ml."invoiceId")::int AS total,
          COUNT(DISTINCT CASE WHEN i.status = 'paga' THEN ml."invoiceId" END)::int AS paid
        FROM message_logs ml
        JOIN invoices i ON i.id = ml."invoiceId"
        WHERE ml."companyId" = ${companyId}
          AND ml.status = 'sent'
          AND ml."sentAt" >= ${months[0].start}
        GROUP BY ml.stage
        ORDER BY ml.stage
      `,

      // Distribuição de status dos clientes
      prisma.client.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { status: true },
      }),

      // Total recuperado (faturas pagas que tiveram cobrança)
      prisma.invoice.aggregate({
        where: {
          companyId,
          status: 'paga',
          messageLogs: { some: { status: 'sent' } },
        },
        _sum: { amount: true },
      }),

      // Total em aberto
      prisma.invoice.aggregate({
        where: {
          companyId,
          status: { in: ['aberta', 'vencida'] },
        },
        _sum: { amount: true },
      }),
    ])

    const stageLabels: Record<string, string> = {
      D_MINUS_5: 'D-5', D_MINUS_2: 'D-2', D_ZERO: 'D-0',
      D_PLUS_1: 'D+1', D_PLUS_5: 'D+5', D_PLUS_10: 'D+10', D_PLUS_14: 'D+14',
    }

    const stageSuccess = stageSuccessRaw.map((s) => ({
      stage: stageLabels[s.stage] || s.stage,
      total: Number(s.total),
      paid: Number(s.paid),
      rate: s.total > 0 ? Math.round((Number(s.paid) / Number(s.total)) * 100) : 0,
    }))

    const clientDistribution = clientStatusCounts.map((c) => ({
      name: c.status === 'ativo' ? 'Ativos' : c.status === 'inativo' ? 'Inativos' : c.status === 'bloqueado' ? 'Bloqueados' : c.status,
      value: c._count.status,
    }))

    return NextResponse.json({
      overdueByMonth,
      messagesByMonth,
      recoveryByMonth: paidAfterMessageByMonth,
      stageSuccess,
      clientDistribution,
      summary: {
        totalRecovered: totalRecovered._sum.amount || 0,
        totalRecoveredFormatted: formatCurrency(totalRecovered._sum.amount || 0),
        totalOpen: totalOpen._sum.amount || 0,
        totalOpenFormatted: formatCurrency(totalOpen._sum.amount || 0),
      },
    })
  } catch (err) {
    console.error('[GET /api/analytics]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
