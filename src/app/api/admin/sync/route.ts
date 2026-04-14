/**
 * POST /api/admin/sync
 * Dispara sync de clientes ou faturas para a empresa autenticada.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createSgpClient } from '@/lib/sgp'

export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action } = await req.json() as { action: 'clientes' | 'faturas' }

    if (!['clientes', 'faturas'].includes(action)) {
      return NextResponse.json({ error: 'action inválida' }, { status: 400 })
    }

    const settings = await prisma.companySettings.findUnique({ where: { companyId } })
    const sgpClient = createSgpClient(settings || {})

    if (!sgpClient) {
      return NextResponse.json({ error: 'SGP não configurado. Configure as credenciais em Configurações.' }, { status: 400 })
    }

    // Roda em background para não bloquear a requisição HTTP
    // (sync completo pode levar vários minutos com muitos clientes)
    if (action === 'clientes') {
      syncClientes(companyId, sgpClient).catch(err =>
        console.error('[sync/bg clientes]', err)
      )
    } else {
      syncFaturas(companyId, sgpClient).catch(err =>
        console.error('[sync/bg faturas]', err)
      )
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

      // Reutiliza whatsapp já salvo
      // (evita 554 chamadas extras ao SGP — bulk não retorna telefones)
      const whatsapp = existente?.whatsapp ?? null

      if (whatsapp) phonesFound++

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
