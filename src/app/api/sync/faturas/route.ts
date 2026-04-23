/**
 * POST /api/sync/faturas — chamado pelo cron-server (CRON_SECRET required)
 * Sincroniza faturas de TODAS as empresas ativas.
 * Suporta SGP e HubSoft baseado no erpType de cada empresa.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSgpClient } from '@/lib/sgp'
import { createHubsoftClient, HubSoftClient } from '@/lib/hubsoft'

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
    const erpType = company.settings?.erpType || 'sgp'

    if (erpType === 'hubsoft') {
      report[company.id] = await syncHubsoft(company.id, company.settings || {})
    } else if (erpType === 'sgp') {
      report[company.id] = await syncSgp(company.id, company.settings || {})
    } else {
      report[company.id] = { skipped: `ERP tipo '${erpType}' não suporta sync automático` }
    }
  }

  return NextResponse.json({ ok: true, report })
}

async function syncSgp(companyId: string, settings: Record<string, unknown>) {
  const sgpClient = createSgpClient(settings)
  if (!sgpClient) return { skipped: 'SGP não configurado' }

  let synced = 0, skipped = 0, errors = 0

  try {
    const clientes = await sgpClient.getClientesComFaturaAberta()

    for (const c of clientes) {
      const externalId = c.cpfcnpj.replace(/\D/g, '')
      const client = await prisma.client.findUnique({
        where: { companyId_externalId: { companyId, externalId } },
      })
      if (!client) { skipped++; continue }

      for (const t of c.titulos ?? []) {
        if (t.status !== 'aberto') continue
        try {
          const invoiceExternalId = String(t.id)
          const dueDate = new Date(`${t.dataVencimento}T03:00:00.000Z`)
          const amount = t.valorCorrigido ?? t.valor
          // Identifica o plano associado ao contrato desta fatura, fallback para plano principal do cliente
          const planName = client.planName || null

          await prisma.invoice.upsert({
            where: { companyId_externalId: { companyId, externalId: invoiceExternalId } },
            update: { dueDate, amount, status: 'aberta', boletoUrl: t.link || null, pixCode: t.codigoPix || null, planName, sgpRaw: JSON.stringify(t), syncedAt: new Date() },
            create: { companyId, externalId: invoiceExternalId, clientId: client.id, dueDate, amount, status: 'aberta', boletoUrl: t.link || null, pixCode: t.codigoPix || null, planName, sgpRaw: JSON.stringify(t) },
          })
          synced++
        } catch (err) { errors++; console.error(`[sync/faturas][${companyId}] Erro:`, err) }
      }
    }
  } catch (err) { errors++; console.error(`[sync/faturas][${companyId}] Falha geral:`, err) }

  return { synced, skipped, errors }
}

async function syncHubsoft(companyId: string, settings: Record<string, unknown>) {
  const hubClient = createHubsoftClient(settings)
  if (!hubClient) return { skipped: 'HubSoft não configurado' }

  let synced = 0, skipped = 0, errors = 0

  try {
    const now = new Date()
    const dataInicio = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
    const dataFim = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)

    const faturas = await hubClient.getFaturasGlobalPaginated(dataInicio, dataFim)

    for (const f of faturas) {
      try {
        const cpfCnpj = f.cliente?.cpf_cnpj?.replace(/\D/g, '')
        if (!cpfCnpj) { skipped++; continue }

        const client = await prisma.client.findFirst({
          where: { companyId, cpfCnpj },
        })
        if (!client) { skipped++; continue }

        const invoiceExternalId = String(f.id_fatura)
        const dueDateStr = HubSoftClient.parseDate(f.data_vencimento)
        const dueDate = new Date(`${dueDateStr}T03:00:00.000Z`)

        const planName = client.planName || null
        await prisma.invoice.upsert({
          where: { companyId_externalId: { companyId, externalId: invoiceExternalId } },
          update: {
            dueDate, amount: f.valor,
            status: f.quitado ? 'paga' : f.status === 'vencido' ? 'vencida' : 'aberta',
            boletoUrl: f.link || null, pixCode: f.pix_copia_cola || null,
            planName, sgpRaw: JSON.stringify(f), syncedAt: new Date(),
          },
          create: {
            companyId, externalId: invoiceExternalId, clientId: client.id,
            dueDate, amount: f.valor,
            status: f.quitado ? 'paga' : f.status === 'vencido' ? 'vencida' : 'aberta',
            boletoUrl: f.link || null, pixCode: f.pix_copia_cola || null,
            planName, sgpRaw: JSON.stringify(f),
          },
        })
        synced++
      } catch (err) { errors++; console.error(`[sync/hubsoft/faturas][${companyId}] Erro:`, err) }
    }
  } catch (err) { errors++; console.error(`[sync/hubsoft/faturas][${companyId}] Falha geral:`, err) }

  return { synced, skipped, errors }
}
