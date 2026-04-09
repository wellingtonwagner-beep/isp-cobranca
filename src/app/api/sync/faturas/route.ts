/**
 * POST /api/sync/faturas
 *
 * Sincroniza faturas em aberto do SGP → banco local.
 *
 * Estratégia: chama o mesmo endpoint URA (/api/ura/clientes/) com status="aberto"
 * e atualiza apenas os registros de Invoice no banco.
 * Clientes não existentes no banco local são ignorados (rodar sync/clientes primeiro).
 *
 * Ordem de execução recomendada no cron:
 *   1. POST /api/sync/clientes  → sincroniza clientes + faturas abertas
 *   2. POST /api/sync/faturas   → atualiza faturas (pode rodar mais vezes ao dia)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sgp } from '@/lib/sgp'

export async function POST(req: NextRequest) {
  const secret     = req.headers.get('x-cron-secret')
  const isInternal = secret === process.env.CRON_SECRET

  if (!isInternal && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const clientes = await sgp.getClientesComFaturaAberta()

    let synced  = 0
    let skipped = 0
    let errors  = 0

    for (const c of clientes) {
      const clientId = c.cpfcnpj.replace(/\D/g, '')

      // Garante que o cliente existe no banco antes de criar a fatura
      const clientExists = await prisma.client.findUnique({ where: { id: clientId } })
      if (!clientExists) { skipped++; continue }

      for (const t of c.titulos ?? []) {
        if (t.status !== 'aberto') continue

        try {
          const faturaId = String(t.id)
          const dueDate  = new Date(`${t.dataVencimento}T03:00:00.000Z`)
          const amount   = t.valorCorrigido ?? t.valor

          await prisma.invoice.upsert({
            where: { id: faturaId },
            update: {
              dueDate,
              amount,
              status:    'aberta',
              boletoUrl: t.link      || null, // URL completa já vem do URA
              pixCode:   t.codigoPix || null,
              sgpRaw:    JSON.stringify(t),
              syncedAt:  new Date(),
            },
            create: {
              id:        faturaId,
              clientId,
              dueDate,
              amount,
              status:    'aberta',
              boletoUrl: t.link      || null,
              pixCode:   t.codigoPix || null,
              sgpRaw:    JSON.stringify(t),
            },
          })
          synced++
        } catch (err) {
          console.error(`[sync/faturas] Erro fatura ${t.id}:`, err)
          errors++
        }
      }
    }

    return NextResponse.json({ ok: true, synced, skipped, errors })
  } catch (err) {
    console.error('[/api/sync/faturas]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
