/**
 * GET /api/dashboard/rankings?limit=5
 * Retorna top N principais clientes pagantes e top N devedores nos ultimos 12 meses.
 *
 * - principaisClientes: faturas com status 'paga', ordenadas por valor pago.
 *   PMR = media de dias entre dueDate e updatedAt (quando virou paga).
 * - principaisDevedores: faturas em aberto/vencida, ordenadas por valor devido.
 *   PMR = media de dias de atraso desde dueDate ate hoje.
 *
 * Linha "Demais" agrupa o restante alem do top N.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

interface RankRow {
  clientId: string
  clientName: string
  total: number
  percent: number
  count: number
  pmrDays: number
}

export async function GET(req: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = Math.max(1, Math.min(20, parseInt(req.nextUrl.searchParams.get('limit') || '5')))
    const since = new Date()
    since.setMonth(since.getMonth() - 12)

    // ── Pagantes: faturas pagas nos ultimos 12 meses ──────────────
    const paidInvoices = await prisma.invoice.findMany({
      where: { companyId, status: 'paga', updatedAt: { gte: since } },
      select: { clientId: true, amount: true, dueDate: true, updatedAt: true },
    })

    const principaisClientes = aggregate(
      paidInvoices.map((i) => ({
        clientId: i.clientId,
        amount: i.amount,
        days: (i.updatedAt.getTime() - i.dueDate.getTime()) / 86400000,
      })),
      limit,
    )

    // ── Devedores: SOMENTE faturas em ATRASO (dueDate < hoje, nao pagas) ──
    //    Faturas a vencer no futuro nao entram no ranking de devedores.
    const now = new Date()
    const openInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ['aberta', 'vencida'] },
        dueDate: { gte: since, lt: now },
      },
      select: { clientId: true, amount: true, dueDate: true },
    })

    const today = now.getTime()
    const principaisDevedores = aggregate(
      openInvoices.map((i) => ({
        clientId: i.clientId,
        amount: i.amount,
        days: Math.max(0, (today - i.dueDate.getTime()) / 86400000),
      })),
      limit,
    )

    // Busca nomes dos clientes que faltaram
    const allClientIds = new Set<string>()
    principaisClientes.top.forEach((r) => allClientIds.add(r.clientId))
    principaisDevedores.top.forEach((r) => allClientIds.add(r.clientId))
    const names = await fetchNames(Array.from(allClientIds))

    const rowsWithName = (rows: { clientId: string; total: number; count: number; pmrDays: number }[], grandTotal: number): RankRow[] =>
      rows.map((r) => ({
        clientId: r.clientId,
        clientName: names[r.clientId] || '(cliente removido)',
        total: r.total,
        count: r.count,
        pmrDays: r.pmrDays,
        percent: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
      }))

    return NextResponse.json({
      principaisClientes: {
        rows: rowsWithName(principaisClientes.top, principaisClientes.grandTotal),
        outros: {
          total: principaisClientes.othersTotal,
          count: principaisClientes.othersCount,
          percent: principaisClientes.grandTotal > 0
            ? Math.round((principaisClientes.othersTotal / principaisClientes.grandTotal) * 100)
            : 0,
        },
        grandTotal: principaisClientes.grandTotal,
      },
      principaisDevedores: {
        rows: rowsWithName(principaisDevedores.top, principaisDevedores.grandTotal),
        outros: {
          total: principaisDevedores.othersTotal,
          count: principaisDevedores.othersCount,
          percent: principaisDevedores.grandTotal > 0
            ? Math.round((principaisDevedores.othersTotal / principaisDevedores.grandTotal) * 100)
            : 0,
        },
        grandTotal: principaisDevedores.grandTotal,
      },
    })
  } catch (err) {
    console.error('[GET /api/dashboard/rankings]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function fetchNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const clients = await prisma.client.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })
  const map: Record<string, string> = {}
  for (const c of clients) map[c.id] = c.name
  return map
}

function aggregate(
  invoices: { clientId: string; amount: number; days: number }[],
  limit: number,
): {
  top: { clientId: string; total: number; count: number; pmrDays: number }[]
  othersTotal: number
  othersCount: number
  grandTotal: number
} {
  const byClient = new Map<string, { total: number; count: number; daysSum: number }>()
  for (const inv of invoices) {
    const cur = byClient.get(inv.clientId) || { total: 0, count: 0, daysSum: 0 }
    cur.total += inv.amount
    cur.count += 1
    cur.daysSum += inv.days
    byClient.set(inv.clientId, cur)
  }

  const all = Array.from(byClient.entries())
    .map(([clientId, v]) => ({
      clientId,
      total: v.total,
      count: v.count,
      pmrDays: v.count > 0 ? Math.round(v.daysSum / v.count) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const top = all.slice(0, limit)
  const others = all.slice(limit)
  const othersTotal = others.reduce((s, r) => s + r.total, 0)
  const othersCount = others.reduce((s, r) => s + r.count, 0)
  const grandTotal = all.reduce((s, r) => s + r.total, 0)

  return { top, othersTotal, othersCount, grandTotal }
}
