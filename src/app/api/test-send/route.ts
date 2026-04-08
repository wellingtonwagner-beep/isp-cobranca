import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dispatchMessage } from '@/lib/message-dispatcher'
import type { Stage } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { invoiceId, stage } = body

    if (!invoiceId || !stage) {
      return NextResponse.json({ error: 'invoiceId e stage são obrigatórios' }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
    }

    // Force test mode for manual sends
    const result = await dispatchMessage(invoice.client, invoice, stage as Stage, true)

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
