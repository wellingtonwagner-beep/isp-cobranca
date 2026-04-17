/**
 * POST /api/admin/sync
 * Dispara sync de clientes ou faturas para a empresa autenticada.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createSgpClient } from '@/lib/sgp'
import { createHubsoftClient, HubSoftClient } from '@/lib/hubsoft'
import { normalizePhone } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action } = await req.json() as { action: 'clientes' | 'faturas' }

    if (!['clientes', 'faturas'].includes(action)) {
      return NextResponse.json({ error: 'action inválida' }, { status: 400 })
    }

    const settings = await prisma.companySettings.findUnique({ where: { companyId } })
    const erpType = settings?.erpType || 'sgp'

    if (erpType === 'hubsoft') {
      const hubClient = createHubsoftClient(settings || {})
      if (!hubClient) {
        return NextResponse.json({ error: 'HubSoft não configurado. Configure as credenciais em Configurações.' }, { status: 400 })
      }

      if (action === 'clientes') {
        syncClientesHubsoft(companyId, hubClient).catch(err =>
          console.error('[sync/bg clientes hubsoft]', err)
        )
      } else {
        syncFaturasHubsoft(companyId, hubClient).catch(err =>
          console.error('[sync/bg faturas hubsoft]', err)
        )
      }
    } else {
      const sgpClient = createSgpClient(settings || {})
      if (!sgpClient) {
        return NextResponse.json({ error: 'SGP não configurado. Configure as credenciais em Configurações.' }, { status: 400 })
      }

      if (action === 'clientes') {
        syncClientes(companyId, sgpClient).catch(err =>
          console.error('[sync/bg clientes]', err)
        )
      } else {
        syncFaturas(companyId, sgpClient).catch(err =>
          console.error('[sync/bg faturas]', err)
        )
      }
    }

    return NextResponse.json({
      ok: true,
      background: true,
      message: `Sync de ${action} iniciado em background. Recarregue a página em 1-2 minutos.`,
    })
  } catch (err) {
    console.error('[POST /api/admin/sync]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function syncClientes(companyId: string, sgpClient: NonNullable<ReturnType<typeof createSgpClient>>) {
  const clientes = await sgpClient.getClientesComFaturaAberta()
  console.log(`[sync/clientes] ${clientes.length} clientes para sincronizar`)

  let clientesSynced = 0
  let faturasSynced = 0
  let phonesFound = 0
  let errors = 0

  // Processa em lotes de 10 paralelos
  const CONCURRENCY = 10
  for (let i = 0; i < clientes.length; i += CONCURRENCY) {
    const lote = clientes.slice(i, i + CONCURRENCY)
    const resultados = await Promise.allSettled(lote.map(async (c) => {
      const externalId = c.cpfcnpj.replace(/\D/g, '')

      const existente = await prisma.client.findUnique({
        where: { companyId_externalId: { companyId, externalId } },
        select: { whatsapp: true },
      })

      // Reutiliza whatsapp já salvo; se não tiver, busca detalhes no SGP
      let whatsapp = existente?.whatsapp ?? null

      if (!whatsapp) {
        const detalhes = await sgpClient.getClienteDetalhes(c.cpfcnpj)
        if (detalhes) {
          const raw = sgpClient.pickBestPhone(detalhes)
          whatsapp = normalizePhone(raw ?? '') ?? null
          if (whatsapp) phonesFound++
        }
      } else {
        phonesFound++
      }

      const client = await prisma.client.upsert({
        where: { companyId_externalId: { companyId, externalId } },
        update: {
          name: c.nome,
          cpfCnpj: c.cpfcnpj,
          city: c.endereco?.cidade || null,
          whatsapp: whatsapp ?? undefined,
          sgpRaw: JSON.stringify(c),
          syncedAt: new Date(),
        },
        create: {
          companyId,
          externalId,
          name: c.nome,
          cpfCnpj: c.cpfcnpj,
          city: c.endereco?.cidade || null,
          whatsapp,
          sgpRaw: JSON.stringify(c),
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
          update: {
            dueDate, amount, status: 'aberta',
            boletoUrl: t.link || null,
            pixCode: t.codigoPix || null,
            sgpRaw: JSON.stringify(t),
            syncedAt: new Date(),
          },
          create: {
            companyId,
            externalId: invoiceExternalId,
            clientId: client.id,
            dueDate, amount, status: 'aberta',
            boletoUrl: t.link || null,
            pixCode: t.codigoPix || null,
            sgpRaw: JSON.stringify(t),
          },
        })
        faturasSynced++
      }

      return client
    }))

    for (const r of resultados) {
      if (r.status === 'rejected') {
        console.error(`[sync/clientes] Erro no lote ${i}:`, r.reason)
        errors++
      }
    }

    if (i % 50 === 0) {
      console.log(`[sync/clientes] Progresso: ${Math.min(i + CONCURRENCY, clientes.length)}/${clientes.length}`)
    }
  }

  console.log(`[sync/clientes] Concluído: ${clientesSynced} clientes, ${faturasSynced} faturas, ${phonesFound} phones, ${errors} erros`)
  return NextResponse.json({ ok: true, clientesSynced, faturasSynced, phonesFound, errors })
}

async function syncFaturas(companyId: string, sgpClient: NonNullable<ReturnType<typeof createSgpClient>>) {
  const clientes = await sgpClient.getClientesComFaturaAberta()

  let synced = 0
  let skipped = 0
  let errors = 0

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

        await prisma.invoice.upsert({
          where: { companyId_externalId: { companyId, externalId: invoiceExternalId } },
          update: {
            dueDate, amount, status: 'aberta',
            boletoUrl: t.link || null,
            pixCode: t.codigoPix || null,
            sgpRaw: JSON.stringify(t),
            syncedAt: new Date(),
          },
          create: {
            companyId,
            externalId: invoiceExternalId,
            clientId: client.id,
            dueDate, amount, status: 'aberta',
            boletoUrl: t.link || null,
            pixCode: t.codigoPix || null,
            sgpRaw: JSON.stringify(t),
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
}

// ── HubSoft Sync ──────────────────────────────────────────────────────────

async function syncClientesHubsoft(companyId: string, hubClient: NonNullable<ReturnType<typeof createHubsoftClient>>) {
  console.log(`[sync/hubsoft/clientes] Iniciando...`)
  const clientes = await hubClient.getAllClientesPaginated()
  console.log(`[sync/hubsoft/clientes] ${clientes.length} clientes para sincronizar`)

  let clientesSynced = 0
  let faturasSynced = 0
  let phonesFound = 0
  let errors = 0

  const CONCURRENCY = 10
  for (let i = 0; i < clientes.length; i += CONCURRENCY) {
    const lote = clientes.slice(i, i + CONCURRENCY)
    const resultados = await Promise.allSettled(lote.map(async (c) => {
      const cpfCnpj = c.cpf_cnpj?.replace(/\D/g, '')
      if (!cpfCnpj) return
      const externalId = String(c.id_cliente)

      const rawPhone = hubClient.pickBestPhone(c)
      const whatsapp = normalizePhone(rawPhone ?? '') ?? null
      if (whatsapp) phonesFound++

      const statusMap: Record<string, string> = {
        servico_habilitado: 'ativo',
        suspenso_debito: 'suspenso',
        cancelado: 'cancelado',
      }
      const servicoStatus = c.servicos?.[0]?.status_prefixo || ''
      const clientStatus = statusMap[servicoStatus] || 'ativo'
      const planName = c.servicos?.[0]?.nome || null
      const city = null // HubSoft não retorna cidade no endpoint de listagem

      const client = await prisma.client.upsert({
        where: { companyId_externalId: { companyId, externalId } },
        update: {
          name: c.nome_razaosocial,
          cpfCnpj,
          whatsapp: whatsapp ?? undefined,
          status: clientStatus,
          planName,
          city,
          sgpRaw: JSON.stringify(c),
          syncedAt: new Date(),
        },
        create: {
          companyId,
          externalId,
          name: c.nome_razaosocial,
          cpfCnpj,
          whatsapp,
          status: clientStatus,
          planName,
          city,
          sgpRaw: JSON.stringify(c),
        },
      })
      clientesSynced++

      // Busca faturas pendentes deste cliente
      try {
        const faturas = await hubClient.getFaturasPendentes('cpf_cnpj', cpfCnpj)
        for (const f of faturas) {
          if (f.quitado) continue
          const invoiceExternalId = String(f.id_fatura)
          const dueDateStr = HubSoftClient.parseDate(f.data_vencimento)
          const dueDate = new Date(`${dueDateStr}T03:00:00.000Z`)
          const amount = f.valor

          await prisma.invoice.upsert({
            where: { companyId_externalId: { companyId, externalId: invoiceExternalId } },
            update: {
              dueDate, amount, status: f.status === 'vencido' ? 'vencida' : 'aberta',
              boletoUrl: f.link || null,
              pixCode: f.pix_copia_cola || null,
              sgpRaw: JSON.stringify(f),
              syncedAt: new Date(),
            },
            create: {
              companyId,
              externalId: invoiceExternalId,
              clientId: client.id,
              dueDate, amount, status: f.status === 'vencido' ? 'vencida' : 'aberta',
              boletoUrl: f.link || null,
              pixCode: f.pix_copia_cola || null,
              sgpRaw: JSON.stringify(f),
            },
          })
          faturasSynced++
        }
      } catch (err) {
        console.error(`[sync/hubsoft/clientes] Erro faturas cliente ${externalId}:`, err)
      }

      return client
    }))

    for (const r of resultados) {
      if (r.status === 'rejected') {
        console.error(`[sync/hubsoft/clientes] Erro no lote ${i}:`, r.reason)
        errors++
      }
    }

    if (i % 50 === 0) {
      console.log(`[sync/hubsoft/clientes] Progresso: ${Math.min(i + CONCURRENCY, clientes.length)}/${clientes.length}`)
    }
  }

  console.log(`[sync/hubsoft/clientes] Concluído: ${clientesSynced} clientes, ${faturasSynced} faturas, ${phonesFound} phones, ${errors} erros`)
}

async function syncFaturasHubsoft(companyId: string, hubClient: NonNullable<ReturnType<typeof createHubsoftClient>>) {
  console.log(`[sync/hubsoft/faturas] Iniciando...`)

  // Busca faturas dos últimos 60 dias até 30 dias à frente
  const now = new Date()
  const dataInicio = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
  const dataFim = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)

  const faturas = await hubClient.getFaturasGlobalPaginated(dataInicio, dataFim)
  console.log(`[sync/hubsoft/faturas] ${faturas.length} faturas para sincronizar`)

  let synced = 0
  let skipped = 0
  let errors = 0

  for (const f of faturas) {
    try {
      const cpfCnpj = f.cliente?.cpf_cnpj?.replace(/\D/g, '')
      if (!cpfCnpj) { skipped++; continue }

      // Busca cliente local pelo CPF/CNPJ ou id_cliente
      const client = await prisma.client.findFirst({
        where: {
          companyId,
          OR: [
            { cpfCnpj },
            { externalId: f.cliente ? String((f.cliente as Record<string, unknown>).id_cliente || '') : '' },
          ],
        },
      })
      if (!client) { skipped++; continue }

      const invoiceExternalId = String(f.id_fatura)
      const dueDateStr = HubSoftClient.parseDate(f.data_vencimento)
      const dueDate = new Date(`${dueDateStr}T03:00:00.000Z`)

      await prisma.invoice.upsert({
        where: { companyId_externalId: { companyId, externalId: invoiceExternalId } },
        update: {
          dueDate,
          amount: f.valor,
          status: f.quitado ? 'paga' : f.status === 'vencido' ? 'vencida' : 'aberta',
          boletoUrl: f.link || null,
          pixCode: f.pix_copia_cola || null,
          sgpRaw: JSON.stringify(f),
          syncedAt: new Date(),
        },
        create: {
          companyId,
          externalId: invoiceExternalId,
          clientId: client.id,
          dueDate,
          amount: f.valor,
          status: f.quitado ? 'paga' : f.status === 'vencido' ? 'vencida' : 'aberta',
          boletoUrl: f.link || null,
          pixCode: f.pix_copia_cola || null,
          sgpRaw: JSON.stringify(f),
        },
      })
      synced++
    } catch (err) {
      console.error(`[sync/hubsoft/faturas] Erro fatura ${f.id_fatura}:`, err)
      errors++
    }
  }

  console.log(`[sync/hubsoft/faturas] Concluído: ${synced} synced, ${skipped} skipped, ${errors} erros`)
}

