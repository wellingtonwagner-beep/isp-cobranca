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

  let synced = 0, skipped = 0, errors = 0, reconciled = 0

  try {
    const clientes = await sgpClient.getClientesComFaturaAberta()

    // Map clientId local -> Set de externalIds de fatura ABERTAS no SGP nesta rodada.
    // Usado depois para detectar faturas locais que sumiram do ERP (canceladas).
    const openByClient = new Map<string, Set<string>>()

    for (const c of clientes) {
      const externalId = c.cpfcnpj.replace(/\D/g, '')
      const client = await prisma.client.findUnique({
        where: { companyId_externalId: { companyId, externalId } },
      })
      if (!client) { skipped++; continue }

      const openSet = openByClient.get(client.id) ?? new Set<string>()

      for (const t of c.titulos ?? []) {
        if (t.status !== 'aberto') continue
        try {
          const invoiceExternalId = String(t.id)
          openSet.add(invoiceExternalId)
          const dueDate = new Date(`${t.dataVencimento}T03:00:00.000Z`)
          const amount = t.valorCorrigido ?? t.valor
          const planName = client.planName || null

          await prisma.invoice.upsert({
            where: { companyId_externalId: { companyId, externalId: invoiceExternalId } },
            update: { dueDate, amount, status: 'aberta', boletoUrl: t.link || null, pixCode: t.codigoPix || null, planName, sgpRaw: JSON.stringify(t), syncedAt: new Date() },
            create: { companyId, externalId: invoiceExternalId, clientId: client.id, dueDate, amount, status: 'aberta', boletoUrl: t.link || null, pixCode: t.codigoPix || null, planName, sgpRaw: JSON.stringify(t) },
          })
          synced++
        } catch (err) { errors++; console.error(`[sync/faturas][${companyId}] Erro:`, err) }
      }

      openByClient.set(client.id, openSet)
    }

    // Reconciliacao: marca como 'cancelada' faturas locais que estavam aberta/vencida
    // e nao apareceram mais no SGP (cliente quitou tudo ou ERP cancelou a fatura).
    // Sao seguras de cancelar pq:
    //   - getClientesComFaturaAberta retorna TODAS as abertas (sem filtro de data)
    //   - se o cliente sumiu da lista, e pq nao tem nenhuma aberta no SGP
    //   - so toca em invoices com externalId (origem ERP), preserva avulsas/manuais
    const localOpens = await prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ['aberta', 'vencida'] },
        externalId: { not: null },
        client: { externalId: { not: null } }, // cliente veio do SGP
      },
      select: { id: true, externalId: true, clientId: true, client: { select: { name: true } } },
    })

    const stale = localOpens.filter((inv) => {
      const seen = openByClient.get(inv.clientId)
      // Se cliente nao apareceu nesta rodada, todas as locais sao stale.
      // Se apareceu, sao stale apenas as que nao estao no Set de abertas.
      return !seen || !seen.has(inv.externalId!)
    })

    if (stale.length > 0) {
      await prisma.invoice.updateMany({
        where: { id: { in: stale.map((i) => i.id) } },
        data: { status: 'cancelada', syncedAt: new Date() },
      })
      reconciled = stale.length
      const sample = stale.slice(0, 5).map((i) => `${i.client.name}#${i.externalId}`).join(', ')
      console.log(`[sync/faturas][${companyId}] Reconciliacao: ${reconciled} fatura(s) local(is) marcada(s) como cancelada (sumiram do SGP). Amostra: ${sample}`)
    }
  } catch (err) { errors++; console.error(`[sync/faturas][${companyId}] Falha geral:`, err) }

  return { synced, skipped, errors, reconciled }
}

async function syncHubsoft(companyId: string, settings: Record<string, unknown>) {
  const hubClient = createHubsoftClient(settings)
  if (!hubClient) return { skipped: 'HubSoft não configurado' }

  let synced = 0, skipped = 0, errors = 0, reconciled = 0

  try {
    // Janela ampla pra cobrir inadimplencia prolongada (necessario pra reconciliacao).
    // 365d retroativos garante que faturas vencidas ha muito tempo apareçam na resposta;
    // se nao aparecerem, e porque foram canceladas no ERP.
    const now = new Date()
    const dataInicio = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
    const dataFim = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)

    const faturas = await hubClient.getFaturasGlobalPaginated(dataInicio, dataFim)

    // Set de externalIds que ainda existem como abertas/vencidas no HubSoft.
    const seenOpenIds = new Set<string>()

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

        const newStatus = f.quitado ? 'paga' : f.status === 'vencido' ? 'vencida' : 'aberta'
        if (newStatus !== 'paga') seenOpenIds.add(invoiceExternalId)

        const planName = client.planName || null
        await prisma.invoice.upsert({
          where: { companyId_externalId: { companyId, externalId: invoiceExternalId } },
          update: {
            dueDate, amount: f.valor,
            status: newStatus,
            boletoUrl: f.link || null, pixCode: f.pix_copia_cola || null,
            planName, sgpRaw: JSON.stringify(f), syncedAt: new Date(),
          },
          create: {
            companyId, externalId: invoiceExternalId, clientId: client.id,
            dueDate, amount: f.valor,
            status: newStatus,
            boletoUrl: f.link || null, pixCode: f.pix_copia_cola || null,
            planName, sgpRaw: JSON.stringify(f),
          },
        })
        synced++
      } catch (err) { errors++; console.error(`[sync/hubsoft/faturas][${companyId}] Erro:`, err) }
    }

    // Reconciliacao: faturas locais aberta/vencida com externalId, vencimento dentro
    // da janela de 365d, que nao apareceram no HubSoft → cancelada.
    // Restringe a janela pra evitar falso-positivo em faturas muito antigas que
    // possam estar fora do range da API.
    const cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    const localOpens = await prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ['aberta', 'vencida'] },
        externalId: { not: null },
        dueDate: { gte: cutoff },
      },
      select: { id: true, externalId: true, client: { select: { name: true } } },
    })

    const stale = localOpens.filter((inv) => !seenOpenIds.has(inv.externalId!))
    if (stale.length > 0) {
      await prisma.invoice.updateMany({
        where: { id: { in: stale.map((i) => i.id) } },
        data: { status: 'cancelada', syncedAt: new Date() },
      })
      reconciled = stale.length
      const sample = stale.slice(0, 5).map((i) => `${i.client.name}#${i.externalId}`).join(', ')
      console.log(`[sync/hubsoft/faturas][${companyId}] Reconciliacao: ${reconciled} fatura(s) marcada(s) como cancelada. Amostra: ${sample}`)
    }
  } catch (err) { errors++; console.error(`[sync/hubsoft/faturas][${companyId}] Falha geral:`, err) }

  return { synced, skipped, errors, reconciled }
}
