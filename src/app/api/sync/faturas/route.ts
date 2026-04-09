/**
 * POST /api/sync/faturas — chamado pelo cron-server (CRON_SECRET required)
 * Sincroniza faturas de TODAS as empresas ativas.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSgpClient } from '@/lib/sgp'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companies = await prisma.company.findMany({
    where: { active: true },
    include: { settings: true },
  })

  const report: Record<string, unknown> = {}

  for (const company of companies) {
    const sgpClient = createSgpClient(company.settings || {})
    if (!sgpClient) { report[company.id] = { skipped: 'SGP não configurado' }; continue }

    let synced = 0, skipped = 0, errors = 0

    try {
      const clientes = await sgpClient.getClientesComFaturaAberta()

      for (const c of clientes) {
        const externalId = c.cpfcnpj.replace(/\D/g, '')
        const client = await prisma.client.findUnique({
          where: { companyId_externalId: { companyId: company.id, externalId } },
        })
        if (!client) { skipped++; continue }

        for (const t of c.titulos ?? []) {
          if (t.status !== 'aberto') continue
          try {
            const invoiceExternalId = String(t.id)
            const dueDate = new Date(`${t.dataVencimento}T03:00:00.000Z`)
            const amount = t.valorCorrigido ?? t.valor

            await prisma.invoice.upsert({
              where: { companyId_externalId: { companyId: company.id, externalId: invoiceExternalId } },
              update: { dueDate, amount, status: 'aberta', boletoUrl: t.link || null, pixCode: t.codigoPix || null, sgpRaw: JSON.stringify(t), syncedAt: new Date() },
              create: { companyId: company.id, externalId: invoiceExternalId, clientId: client.id, dueDate, amount, status: 'aberta', boletoUrl: t.link || null, pixCode: t.codigoPix || null, sgpRaw: JSON.stringify(t) },
            })
            synced++
          } catch (err) { errors++; console.error(`[sync/faturas][${company.id}] Erro:`, err) }
        }
      }
    } catch (err) { errors++; console.error(`[sync/faturas][${company.id}] Falha geral:`, err) }

    report[company.id] = { synced, skipped, errors }
  }

  return NextResponse.json({ ok: true, report })
}
