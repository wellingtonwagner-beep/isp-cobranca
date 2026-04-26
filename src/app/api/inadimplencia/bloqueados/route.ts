/**
 * GET /api/inadimplencia/bloqueados
 * Lista clientes bloqueados pelo billing engine por terem ao menos uma
 * fatura aberta/vencida ha mais de 60 dias.
 *
 * Para cada cliente:
 *   - nome, whatsapp, cpfCnpj, status, planName
 *   - quantidade de faturas em atraso
 *   - somatorio devido
 *   - fatura mais antiga (dueDate + dias de atraso)
 *   - ultima mensagem enviada (sentAt + stage)
 *
 * Filtros: q (busca por nome), order (oldest|amount), page (default 1)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'

export async function GET(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = req.nextUrl
    const q = searchParams.get('q') || ''
    const order = searchParams.get('order') || 'oldest' // oldest | amount
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = 10

    const today = new Date()
    const cutoff = new Date(today.getTime() - 60 * 86400000)

    // Buscar clientIds com fatura em aberto/vencida com dueDate < cutoff
    const oldInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ['aberta', 'vencida'] },
        dueDate: { lt: cutoff },
      },
      select: { clientId: true },
      distinct: ['clientId'],
    })
    const clientIds = oldInvoices.map((i) => i.clientId)

    if (clientIds.length === 0) {
      return NextResponse.json({ rows: [], total: 0, page, pages: 1 })
    }

    // Carrega clientes filtrados por busca
    const clientWhere: Record<string, unknown> = { id: { in: clientIds } }
    if (q) clientWhere.name = { contains: q, mode: 'insensitive' }

    const totalClients = await prisma.client.count({ where: clientWhere })
    const clients = await prisma.client.findMany({
      where: clientWhere,
      select: {
        id: true, name: true, whatsapp: true, cpfCnpj: true, status: true, planName: true,
      },
    })

    // Para cada cliente: agrega faturas em aberto/vencida (todas, nao so >60d) e ultima msg
    const rows = await Promise.all(
      clients.map(async (c) => {
        const invoicesAgg = await prisma.invoice.aggregate({
          where: { clientId: c.id, status: { in: ['aberta', 'vencida'] } },
          _sum: { amount: true },
          _count: true,
          _min: { dueDate: true },
        })
        const lastLog = await prisma.messageLog.findFirst({
          where: { clientId: c.id, status: 'sent' },
          orderBy: { sentAt: 'desc' },
          select: { sentAt: true, stage: true },
        })
        const oldestDue = invoicesAgg._min.dueDate
        const daysOverdue = oldestDue ? Math.floor((today.getTime() - oldestDue.getTime()) / 86400000) : 0
        return {
          clientId: c.id,
          name: c.name,
          whatsapp: c.whatsapp,
          cpfCnpj: c.cpfCnpj,
          status: c.status,
          planName: c.planName,
          openInvoices: invoicesAgg._count,
          totalOwed: invoicesAgg._sum.amount || 0,
          oldestDueDate: oldestDue,
          daysOverdue,
          lastSent: lastLog,
        }
      }),
    )

    // Ordenacao - retrocompat com 'order' (oldest|amount), mais sortBy/sortDir.
    // Se sortBy estiver presente, ele tem prioridade sobre order.
    const sortBy = searchParams.get('sortBy')
    const sortDir = searchParams.get('sortDir') === 'desc' ? -1 : 1
    if (sortBy) {
      rows.sort((a, b) => {
        let av: string | number = ''
        let bv: string | number = ''
        if (sortBy === 'name') { av = a.name; bv = b.name }
        else if (sortBy === 'whatsapp') { av = a.whatsapp || ''; bv = b.whatsapp || '' }
        else if (sortBy === 'planName') { av = a.planName || ''; bv = b.planName || '' }
        else if (sortBy === 'openInvoices') { av = a.openInvoices; bv = b.openInvoices }
        else if (sortBy === 'totalOwed') { av = a.totalOwed; bv = b.totalOwed }
        else if (sortBy === 'oldestDueDate') { av = a.oldestDueDate?.getTime() || 0; bv = b.oldestDueDate?.getTime() || 0 }
        else if (sortBy === 'daysOverdue') { av = a.daysOverdue; bv = b.daysOverdue }
        else if (sortBy === 'lastSent') { av = a.lastSent?.sentAt?.getTime() || 0; bv = b.lastSent?.sentAt?.getTime() || 0 }
        if (av < bv) return -1 * sortDir
        if (av > bv) return 1 * sortDir
        return 0
      })
    } else if (order === 'amount') {
      rows.sort((a, b) => b.totalOwed - a.totalOwed)
    } else {
      rows.sort((a, b) => b.daysOverdue - a.daysOverdue)
    }

    // Paginacao em memoria
    const start = (page - 1) * limit
    const paginated = rows.slice(start, start + limit)

    return NextResponse.json({
      rows: paginated,
      total: totalClients,
      page,
      pages: Math.max(1, Math.ceil(totalClients / limit)),
    })
  } catch (err) {
    console.error('[GET /api/inadimplencia/bloqueados]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
