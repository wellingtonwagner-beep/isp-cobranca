/**
 * POST /api/sync/clientes — chamado pelo cron-server (CRON_SECRET required)
 * Sincroniza clientes de TODAS as empresas ativas.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSgpClient } from '@/lib/sgp'
import { normalizePhone } from '@/lib/utils'

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

    let clientesSynced = 0, faturasSynced = 0, phonesFound = 0, errors = 0

    try {
      const clientes = await sgpClient.getClientesComFaturaAberta()

      for (const c of clientes) {
        try {
          const externalId = c.cpfcnpj.replace(/\D/g, '')

          const existente = await prisma.client.findUnique({
            where: { companyId_externalId: { companyId: company.id, externalId } },
            select: { whatsapp: true },
          })

          let whatsapp = existente?.whatsapp ?? null

          if (!whatsapp) {
            const detalhes = await sgpClient.getClienteDetalhes(c.cpfcnpj)
            if (detalhes) {
              const raw = sgpClient.pickBestPhone(detalhes)
              whatsapp = normalizePhone(raw ?? '') ?? null
              if (whatsapp) phonesFound++
            }
          }

          const client = await prisma.client.upsert({
            where: { companyId_externalId: { companyId: company.id, externalId } },
            update: {
              name: c.nome, cpfCnpj: c.cpfcnpj, city: c.endereco?.cidade || null,
              whatsapp: whatsapp ?? undefined, sgpRaw: JSON.stringify(c), syncedAt: new Date(),
            },
            create: {
              companyId: company.id, externalId, name: c.nome, cpfCnpj: c.cpfcnpj,
              city: c.endereco?.cidade || null, whatsapp, sgpRaw: JSON.stringify(c),
            },
          })
          clientesSynced++

          for (const t of c.titulos ?? []) {
            if (t.status !== 'aberto') continue
            const invoiceExternalId = String(t.id)
            const dueDate = new Date(`${t.dataVencimento}T03:00:00.000Z`)
            const amount = t.valorCorrigido ?? t.valor

            await prisma.invoice.upsert({
              where: { companyId_externalId: { companyId: company.id, externalId: invoiceExternalId } },
              update: { dueDate, amount, status: 'aberta', boletoUrl: t.link || null, pixCode: t.codigoPix || null, sgpRaw: JSON.stringify(t), syncedAt: new Date() },
              create: { companyId: company.id, externalId: invoiceExternalId, clientId: client.id, dueDate, amount, status: 'aberta', boletoUrl: t.link || null, pixCode: t.codigoPix || null, sgpRaw: JSON.stringify(t) },
            })
            faturasSynced++
          }
        } catch (err) { errors++ ; console.error(`[sync/clientes][${company.id}] Erro:`, err) }
      }
    } catch (err) { errors++ ; console.error(`[sync/clientes][${company.id}] Falha geral:`, err) }

    report[company.id] = { clientesSynced, faturasSynced, phonesFound, errors }
  }

  return NextResponse.json({ ok: true, report })
}
