import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'
import { dispatchMessage } from '@/lib/message-dispatcher'
import type { Stage } from '@/types'

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { invoiceId, stage } = await req.json()

    if (!invoiceId || !stage) {
      return NextResponse.json({ error: 'invoiceId e stage são obrigatórios' }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, companyId },
      include: { client: true },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
    }

    // Modo teste forçado para envios manuais
    const result = await dispatchMessage(invoice.client, invoice, stage as Stage, true, null)

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
