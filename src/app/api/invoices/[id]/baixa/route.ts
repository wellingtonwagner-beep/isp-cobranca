/**
 * POST   /api/invoices/[id]/baixa  — marca fatura como paga (baixa manual)
 * DELETE /api/invoices/[id]/baixa  — desfaz a baixa (reverte para aberta)
 *
 * Disponivel em qualquer erpType: util para registrar pagamentos fora do
 * fluxo automatico (dinheiro, transferencia, TED, deposito).
 *
 * Body POST: { note?: string, method?: 'pix' | 'dinheiro' | 'transferencia' | 'boleto' | 'cartao' | 'outro' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'

async function ownsInvoice(companyId: string, id: string): Promise<boolean> {
  const inv = await prisma.invoice.findUnique({ where: { id }, select: { companyId: true } })
  return inv?.companyId === companyId
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await ownsInvoice(companyId, params.id))) {
    return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { note, method } = body as { note?: string; method?: string }

    const noteText = note?.trim() || null
    const prefix = method ? `[${method}] ` : ''
    const paymentNote = `${prefix}${noteText || 'Baixa manual'}`.trim()

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: 'paga',
        paidAt: new Date(),
        paidVia: 'manual',
        paymentNote,
      },
      include: { client: { select: { name: true } } },
    })

    return NextResponse.json({ ok: true, invoice })
  } catch (err) {
    console.error('[POST /api/invoices/:id/baixa]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await ownsInvoice(companyId, params.id))) {
    return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
  }

  try {
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: 'aberta',
        paidAt: null,
        paidVia: null,
        paymentNote: null,
      },
    })
    return NextResponse.json({ ok: true, invoice })
  } catch (err) {
    console.error('[DELETE /api/invoices/:id/baixa]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
