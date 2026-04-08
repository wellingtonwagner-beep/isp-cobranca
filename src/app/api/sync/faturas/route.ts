import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sgp } from '@/lib/sgp'
import { parseDate } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  const isInternal = secret === process.env.CRON_SECRET

  if (!isInternal && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const invoices = await sgp.getOpenInvoices()

    let synced = 0
    let errors = 0

    for (const inv of invoices) {
      try {
        const id = String(inv.id_fatura)
        const clientId = String(inv.id_cliente)

        // Garante que o cliente existe antes de criar a fatura
        const clientExists = await prisma.client.findUnique({ where: { id: clientId } })
        if (!clientExists) continue

        const dueDate = parseDate(String(inv.data_vencimento))
        const amount = typeof inv.valor === 'string' ? parseFloat(inv.valor.replace(',', '.')) : inv.valor

        await prisma.invoice.upsert({
          where: { id },
          update: {
            dueDate,
            amount,
            status: inv.status || 'aberta',
            boletoUrl: inv.link_boleto || null,
            pixCode: inv.codigo_pix || null,
            sgpRaw: JSON.stringify(inv),
            syncedAt: new Date(),
          },
          create: {
            id,
            clientId,
            dueDate,
            amount,
            status: inv.status || 'aberta',
            boletoUrl: inv.link_boleto || null,
            pixCode: inv.codigo_pix || null,
            sgpRaw: JSON.stringify(inv),
          },
        })
        synced++
      } catch {
        errors++
      }
    }

    return NextResponse.json({ ok: true, synced, errors })
  } catch (err) {
    console.error('[/api/sync/faturas]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
