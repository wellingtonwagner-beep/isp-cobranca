import { NextRequest, NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateBR } from '@/lib/utils'

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`
    }
    return val
  }
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) {
    lines.push(row.map(escape).join(','))
  }
  return '\ufeff' + lines.join('\r\n')
}

export async function GET(req: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const type = req.nextUrl.searchParams.get('type')

    if (type === 'clientes') {
      const clients = await prisma.client.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { invoices: true, messageLogs: true } },
        },
      })
      const headers = ['Nome', 'CPF/CNPJ', 'WhatsApp', 'Telefone', 'Email', 'Status', 'Cidade', 'Plano', 'Faturas', 'Mensagens', 'Cadastrado em']
      const rows = clients.map((c) => [
        c.name,
        c.cpfCnpj || '',
        c.whatsapp || '',
        c.phone || '',
        c.email || '',
        c.status,
        c.city || '',
        c.planName || '',
        String(c._count.invoices),
        String(c._count.messageLogs),
        formatDateBR(c.createdAt),
      ])
      return csvResponse(toCsv(headers, rows), 'clientes')
    }

    if (type === 'inadimplencia') {
      const invoices = await prisma.invoice.findMany({
        where: {
          companyId,
          status: { in: ['aberta', 'vencida'] },
          dueDate: { lt: new Date() },
        },
        orderBy: { dueDate: 'asc' },
        include: {
          client: { select: { name: true, whatsapp: true, phone: true, status: true } },
          messageLogs: { orderBy: { sentAt: 'desc' }, take: 1, select: { stage: true, sentAt: true, status: true } },
        },
      })
      const headers = ['Cliente', 'Status Cliente', 'Vencimento', 'Valor', 'Dias Atraso', 'Último Estágio', 'Data Último Contato', 'WhatsApp']
      const rows = invoices.map((inv) => {
        const daysOverdue = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000)
        const lastLog = inv.messageLogs[0]
        return [
          inv.client.name,
          inv.client.status,
          formatDateBR(inv.dueDate),
          formatCurrency(inv.amount),
          String(daysOverdue),
          lastLog?.stage || 'Sem contato',
          lastLog ? formatDateBR(lastLog.sentAt) : '',
          inv.client.whatsapp || inv.client.phone || '',
        ]
      })
      return csvResponse(toCsv(headers, rows), 'inadimplencia')
    }

    if (type === 'bloqueados') {
      const today = new Date()
      const cutoff = new Date(today.getTime() - 60 * 86400000)
      const oldInvoices = await prisma.invoice.findMany({
        where: { companyId, status: { in: ['aberta', 'vencida'] }, dueDate: { lt: cutoff } },
        select: { clientId: true },
        distinct: ['clientId'],
      })
      const clientIds = oldInvoices.map((i) => i.clientId)
      const clients = await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, whatsapp: true, cpfCnpj: true, status: true, planName: true },
        orderBy: { name: 'asc' },
      })
      const headers = ['Cliente', 'CPF/CNPJ', 'WhatsApp', 'Plano', 'Status', 'Faturas em atraso', 'Total devido', 'Vencimento mais antigo', 'Dias de atraso']
      const rows = await Promise.all(clients.map(async (c) => {
        const agg = await prisma.invoice.aggregate({
          where: { clientId: c.id, status: { in: ['aberta', 'vencida'] } },
          _sum: { amount: true },
          _count: true,
          _min: { dueDate: true },
        })
        const oldest = agg._min.dueDate
        const days = oldest ? Math.floor((today.getTime() - oldest.getTime()) / 86400000) : 0
        return [
          c.name,
          c.cpfCnpj || '',
          c.whatsapp || '',
          c.planName || '',
          c.status,
          String(agg._count),
          formatCurrency(agg._sum.amount || 0),
          oldest ? formatDateBR(oldest) : '',
          String(days),
        ]
      }))
      return csvResponse(toCsv(headers, rows), 'clientes_bloqueados_60d')
    }

    if (type === 'cobrancas') {
      const from = req.nextUrl.searchParams.get('from')
      const to = req.nextUrl.searchParams.get('to')
      const where: Record<string, unknown> = { companyId }
      if (from) where.sentAt = { ...(where.sentAt as object || {}), gte: new Date(from) }
      if (to) where.sentAt = { ...(where.sentAt as object || {}), lte: new Date(`${to}T23:59:59.999Z`) }

      const logs = await prisma.messageLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: 5000,
        include: {
          client: { select: { name: true } },
          invoice: { select: { dueDate: true, amount: true } },
        },
      })
      const stageLabels: Record<string, string> = {
        D_MINUS_5: 'D-5', D_MINUS_2: 'D-2', D_ZERO: 'D-0',
        D_PLUS_1: 'D+1', D_PLUS_5: 'D+5', D_PLUS_10: 'D+10', D_PLUS_14: 'D+14',
      }
      const headers = ['Data Envio', 'Cliente', 'Estágio', 'WhatsApp', 'Status', 'Vencimento Fatura', 'Valor Fatura', 'Modo Teste', 'Erro']
      const rows = logs.map((l) => [
        new Date(l.sentAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        l.client.name,
        stageLabels[l.stage] || l.stage,
        l.whatsappTo,
        l.status,
        formatDateBR(l.invoice.dueDate),
        formatCurrency(l.invoice.amount),
        l.testMode ? 'Sim' : 'Não',
        l.errorMessage || '',
      ])
      return csvResponse(toCsv(headers, rows), 'cobrancas')
    }

    return NextResponse.json({ error: 'Tipo inválido. Use: clientes, inadimplencia, cobrancas' }, { status: 400 })
  } catch (err) {
    console.error('[GET /api/export]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function csvResponse(csv: string, filename: string): NextResponse {
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}_${date}.csv"`,
    },
  })
}
