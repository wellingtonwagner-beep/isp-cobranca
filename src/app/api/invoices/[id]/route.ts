/**
 * DELETE /api/invoices/[id]  — cancela fatura (somente erpType=manual)
 *    Marca como 'cancelada' preservando o historico (nao faz hard delete).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { erpType: true },
  })
  if (settings?.erpType !== 'manual') {
    return NextResponse.json({
      error: 'Cancelamento só é permitido no modo "Banco próprio do sistema".',
    }, { status: 403 })
  }

  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    select: { companyId: true, status: true },
  })
  if (!inv || inv.companyId !== companyId) {
    return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
  }
  if (inv.status === 'paga') {
    return NextResponse.json({ error: 'Não é possível cancelar uma fatura já paga' }, { status: 409 })
  }

  try {
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: { status: 'cancelada' },
    })
    return NextResponse.json({ ok: true, invoice })
  } catch (err) {
    console.error('[DELETE /api/invoices/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
