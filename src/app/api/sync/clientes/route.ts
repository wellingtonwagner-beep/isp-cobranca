/**
 * POST /api/sync/clientes
 *
 * Sincroniza clientes (e seus títulos em aberto) do SGP → banco local.
 *
 * Fluxo:
 *   1. Busca todos os clientes com faturas abertas via URA (/api/ura/clientes/)
 *   2. Para clientes SEM whatsapp cadastrado, consulta /api/ura/consultacliente/
 *      para obter telefone (celular preferido, fixo como fallback)
 *   3. Upsert de clientes + faturas em uma só passagem
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sgp } from '@/lib/sgp'
import { normalizePhone } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const secret     = req.headers.get('x-cron-secret')
  const isInternal = secret === process.env.CRON_SECRET

  if (!isInternal && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const clientes = await sgp.getClientesComFaturaAberta()

    let clientesSynced = 0
    let faturasSynced  = 0
    let phonesFound    = 0
    let errors         = 0

    for (const c of clientes) {
      try {
        const id = c.cpfcnpj.replace(/\D/g, '')

        // Verifica se já existe no banco e se já tem whatsapp
        const existente = await prisma.client.findUnique({
          where: { id },
          select: { whatsapp: true },
        })

        let whatsapp = existente?.whatsapp ?? null

        // Busca telefone no SGP apenas se não tiver cadastrado localmente
        if (!whatsapp) {
          const detalhes = await sgp.getClienteDetalhes(c.cpfcnpj)
          if (detalhes) {
            const raw = sgp.pickBestPhone(detalhes)
            whatsapp  = normalizePhone(raw ?? '') ?? null
            if (whatsapp) phonesFound++
          }
        }

        await prisma.client.upsert({
          where: { id },
          update: {
            name:     c.nome,
            cpfCnpj:  c.cpfcnpj,
            city:     c.endereco?.cidade || null,
            whatsapp: whatsapp ?? undefined, // não sobrescreve com null se já tinha
            sgpRaw:   JSON.stringify(c),
            syncedAt: new Date(),
          },
          create: {
            id,
            name:    c.nome,
            cpfCnpj: c.cpfcnpj,
            city:    c.endereco?.cidade || null,
            whatsapp,
            sgpRaw:  JSON.stringify(c),
          },
        })
        clientesSynced++

        // Upsert das faturas em aberto
        for (const t of c.titulos ?? []) {
          if (t.status !== 'aberto') continue

          const faturaId = String(t.id)
          const dueDate  = new Date(`${t.dataVencimento}T03:00:00.000Z`)
          const amount   = t.valorCorrigido ?? t.valor

          await prisma.invoice.upsert({
            where: { id: faturaId },
            update: {
              dueDate,
              amount,
              status:    'aberta',
              boletoUrl: t.link     || null, // link já é URL completa no URA
              pixCode:   t.codigoPix || null,
              sgpRaw:    JSON.stringify(t),
              syncedAt:  new Date(),
            },
            create: {
              id:        faturaId,
              clientId:  id,
              dueDate,
              amount,
              status:    'aberta',
              boletoUrl: t.link     || null,
              pixCode:   t.codigoPix || null,
              sgpRaw:    JSON.stringify(t),
            },
          })
          faturasSynced++
        }
      } catch (err) {
        console.error(`[sync/clientes] Erro cliente ${c.cpfcnpj}:`, err)
        errors++
      }
    }

    return NextResponse.json({
      ok: true,
      clientesSynced,
      faturasSynced,
      phonesFound,
      errors,
    })
  } catch (err) {
    console.error('[/api/sync/clientes]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
