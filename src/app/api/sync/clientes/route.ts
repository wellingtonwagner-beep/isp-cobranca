/**
 * POST /api/sync/clientes — chamado pelo cron-server (CRON_SECRET required)
 * Sincroniza clientes de TODAS as empresas ativas.
 * Suporta SGP e HubSoft baseado no erpType de cada empresa.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSgpClient } from '@/lib/sgp'
import { createHubsoftClient, HubSoftClient } from '@/lib/hubsoft'
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

  let clientesSynced = 0, faturasSynced = 0, phonesFound = 0, errors = 0

  try {
    const clientes = await sgpClient.getClientesComFaturaAberta()

    for (const c of clientes) {
      try {
        const externalId = c.cpfcnpj.replace(/\D/g, '')

        const existente = await prisma.client.findUnique({
          where: { companyId_externalId: { companyId, externalId } },
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
          where: { companyId_externalId: { companyId, externalId } },
          update: {
            name: c.nome, cpfCnpj: c.cpfcnpj, city: c.endereco?.cidade || null,
            whatsapp: whatsapp ?? undefined, sgpRaw: JSON.stringify(c), syncedAt: new Date(),
          },
          create: {
            companyId, externalId, name: c.nome, cpfCnpj: c.cpfcnpj,
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
            where: { companyId_externalId: { companyId, externalId: invoiceExternalId } },
            update: { dueDate, amount, status: 'aberta', boletoUrl: t.link || null, pixCode: t.codigoPix || null, sgpRaw: JSON.stringify(t), syncedAt: new Date() },
            create: { companyId, externalId: invoiceExternalId, clientId: client.id, dueDate, amount, status: 'aberta', boletoUrl: t.link || null, pixCode: t.codigoPix || null, sgpRaw: JSON.stringify(t) },
          })
          faturasSynced++
        }
      } catch (err) { errors++ ; console.error(`[sync/clientes][${companyId}] Erro:`, err) }
    }
  } catch (err) { errors++ ; console.error(`[sync/clientes][${companyId}] Falha geral:`, err) }

  return { clientesSynced, faturasSynced, phonesFound, errors }
}

async function syncHubsoft(companyId: string, settings: Record<string, unknown>) {
  const hubClient = createHubsoftClient(settings)
  if (!hubClient) return { skipped: 'HubSoft não configurado' }

  let clientesSynced = 0, faturasSynced = 0, phonesFound = 0, errors = 0

  try {
    const clientes = await hubClient.getAllClientesPaginated()

    for (const c of clientes) {
      try {
        const cpfCnpj = c.cpf_cnpj?.replace(/\D/g, '')
        if (!cpfCnpj) continue
        const externalId = String(c.id_cliente)

        const rawPhone = hubClient.pickBestPhone(c)
        const whatsapp = normalizePhone(rawPhone ?? '') ?? null
        if (whatsapp) phonesFound++

        const statusMap: Record<string, string> = {
          servico_habilitado: 'ativo',
          suspenso_debito: 'suspenso',
          cancelado: 'cancelado',
        }
        const clientStatus = statusMap[c.servicos?.[0]?.status_prefixo || ''] || 'ativo'

        const client = await prisma.client.upsert({
          where: { companyId_externalId: { companyId, externalId } },
          update: {
            name: c.nome_razaosocial, cpfCnpj, whatsapp: whatsapp ?? undefined,
            status: clientStatus, planName: c.servicos?.[0]?.nome || null,
            sgpRaw: JSON.stringify(c), syncedAt: new Date(),
          },
          create: {
            companyId, externalId, name: c.nome_razaosocial, cpfCnpj, whatsapp,
            status: clientStatus, planName: c.servicos?.[0]?.nome || null,
            sgpRaw: JSON.stringify(c),
          },
        })
        clientesSynced++

        // Busca faturas pendentes
        const faturas = await hubClient.getFaturasPendentes('cpf_cnpj', cpfCnpj)
        for (const f of faturas) {
          if (f.quitado) continue
          const invoiceExternalId = String(f.id_fatura)
          const dueDateStr = HubSoftClient.parseDate(f.data_vencimento)
          const dueDate = new Date(`${dueDateStr}T03:00:00.000Z`)

          await prisma.invoice.upsert({
            where: { companyId_externalId: { companyId, externalId: invoiceExternalId } },
            update: {
              dueDate, amount: f.valor, status: f.status === 'vencido' ? 'vencida' : 'aberta',
              boletoUrl: f.link || null, pixCode: f.pix_copia_cola || null,
              sgpRaw: JSON.stringify(f), syncedAt: new Date(),
            },
            create: {
              companyId, externalId: invoiceExternalId, clientId: client.id,
              dueDate, amount: f.valor, status: f.status === 'vencido' ? 'vencida' : 'aberta',
              boletoUrl: f.link || null, pixCode: f.pix_copia_cola || null,
              sgpRaw: JSON.stringify(f),
            },
          })
          faturasSynced++
        }
      } catch (err) { errors++; console.error(`[sync/hubsoft/clientes][${companyId}] Erro:`, err) }
    }
  } catch (err) { errors++; console.error(`[sync/hubsoft/clientes][${companyId}] Falha geral:`, err) }

  return { clientesSynced, faturasSynced, phonesFound, errors }
}
