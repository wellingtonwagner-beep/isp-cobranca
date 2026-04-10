/**
 * POST /api/admin/sync
 * Dispara sync de clientes ou faturas para a empresa autenticada.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createSgpClient } from '@/lib/sgp'
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
    const sgpClient = createSgpClient(settings || {})

    if (!sgpClient) {
      return NextResponse.json({ error: 'SGP não configurado. Configure as credenciais em Configurações.' }, { status: 400 })
    }

    if (action === 'clientes') {
      return syncClientes(companyId, sgpClient)
    } else {
      return syncFaturas(companyId, sgpClient)
    }
  } catch (err) {
    console.error('[POST /api/admin/sync]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function syncClientes(companyId: string, sgpClient: NonNullable<ReturnType<typeof createSgpClient>>) {
  const clientes = await sgpClient.getClientesComFaturaAberta()

  let clientesSynced = 0
  let faturasSynced = 0
  let phonesFound = 0
  let errors = 0

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
    } catch (err) {
      console.error(`[sync/clientes] Erro cliente ${c.cpfcnpj}:`, err)
      errors++
    }
  }

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
