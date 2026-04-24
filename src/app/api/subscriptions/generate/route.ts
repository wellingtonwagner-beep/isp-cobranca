/**
 * POST /api/subscriptions/generate
 * Gera as faturas do dia para todas as assinaturas ativas (todas as empresas
 * com erpType=manual). Chamado pelo cron-server diariamente.
 *
 * Requer header 'x-cron-secret'.
 *
 * Lógica:
 *   Para cada subscription ativa onde dayOfMonth = hoje (ou dayOfMonth > diasDoMes
 *   e hoje eh o ultimo dia do mes):
 *     - Se endDate < hoje -> pula (assinatura expirou; marca active=false)
 *     - Se lastGeneratedAt no mesmo mes+ano -> pula (ja gerada)
 *     - Cria Invoice com amount do produto, dueDate=hoje, status=aberta,
 *       sequentialNumber, pixTxid, vinculada a subscription+product
 *     - Atualiza subscription.lastGeneratedAt
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

function generateTxid(): string {
  return randomBytes(16).toString('hex').substring(0, 26).toUpperCase()
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

function sameYearMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayNow = now.getUTCDate()
  const maxDayThisMonth = daysInMonth(now.getUTCFullYear(), now.getUTCMonth())
  const isLastDay = dayNow === maxDayThisMonth

  // Companies em modo manual
  const companies = await prisma.company.findMany({
    where: { active: true, settings: { erpType: 'manual' } },
    select: { id: true },
  })

  const report: Record<string, { generated: number; skipped: number; expired: number; errors: number }> = {}

  for (const company of companies) {
    const stat = { generated: 0, skipped: 0, expired: 0, errors: 0 }

    const subs = await prisma.subscription.findMany({
      where: {
        companyId: company.id,
        active: true,
        OR: [
          { dayOfMonth: dayNow },
          // Se o dia configurado > max do mes atual, dispara no ultimo dia do mes
          ...(isLastDay ? [{ dayOfMonth: { gt: maxDayThisMonth } }] : []),
        ],
      },
      include: { product: { select: { id: true, name: true, amount: true, active: true } } },
    })

    for (const sub of subs) {
      try {
        // Expirada
        if (sub.endDate && sub.endDate < todayUtc) {
          await prisma.subscription.update({ where: { id: sub.id }, data: { active: false } })
          stat.expired++
          continue
        }
        // Ainda nao iniciou
        if (sub.startDate > todayUtc) { stat.skipped++; continue }
        // Produto desativado
        if (!sub.product.active) { stat.skipped++; continue }
        // Ja gerada este mes
        if (sub.lastGeneratedAt && sameYearMonth(sub.lastGeneratedAt, todayUtc)) {
          stat.skipped++
          continue
        }

        // Proximo sequentialNumber da empresa
        const last = await prisma.invoice.findFirst({
          where: { companyId: company.id, sequentialNumber: { not: null } },
          orderBy: { sequentialNumber: 'desc' },
          select: { sequentialNumber: true },
        })
        const nextSeq = (last?.sequentialNumber || 0) + 1

        await prisma.invoice.create({
          data: {
            companyId: company.id,
            clientId: sub.clientId,
            productId: sub.productId,
            subscriptionId: sub.id,
            dueDate: todayUtc,
            amount: sub.product.amount,
            status: 'aberta',
            planName: sub.product.name,
            description: `Mensalidade ${sub.product.name}`,
            sequentialNumber: nextSeq,
            pixTxid: generateTxid(),
          },
        })

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { lastGeneratedAt: todayUtc },
        })
        stat.generated++
      } catch (err) {
        console.error(`[subscriptions/generate] Erro sub ${sub.id}:`, err)
        stat.errors++
      }
    }

    report[company.id] = stat
  }

  return NextResponse.json({
    ok: true,
    date: todayUtc.toISOString().slice(0, 10),
    report,
  })
}
