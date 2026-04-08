import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sgp } from '@/lib/sgp'
import { normalizePhone } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  const isInternal = secret === process.env.CRON_SECRET

  // Permite chamada autenticada ou de desenvolvimento
  if (!isInternal && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const clients = await sgp.getAllClients()

    const created = 0
    let updated = 0
    let errors = 0

    for (const c of clients) {
      try {
        const id = String(c.id_cliente)
        const whatsapp = normalizePhone(c.celular || c.fone || '')

        await prisma.client.upsert({
          where: { id },
          update: {
            name: c.nome,
            cpfCnpj: c.cpf_cnpj || null,
            email: c.email || null,
            phone: c.fone || null,
            whatsapp,
            status: c.status || 'ativo',
            city: c.cidade || null,
            sgpRaw: JSON.stringify(c),
            syncedAt: new Date(),
          },
          create: {
            id,
            name: c.nome,
            cpfCnpj: c.cpf_cnpj || null,
            email: c.email || null,
            phone: c.fone || null,
            whatsapp,
            status: c.status || 'ativo',
            city: c.cidade || null,
            sgpRaw: JSON.stringify(c),
          },
        })
        // Track created vs updated via upsert result would need extra query — just count
        updated++
      } catch {
        errors++
      }
    }

    return NextResponse.json({ ok: true, synced: clients.length, updated, created, errors })
  } catch (err) {
    console.error('[/api/sync/clientes]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
