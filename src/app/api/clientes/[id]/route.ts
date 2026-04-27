/**
 * PUT    /api/clientes/[id]  — atualiza cliente (somente erpType=manual)
 * DELETE /api/clientes/[id]  — remove cliente (somente erpType=manual)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'
import { buildClientSearchKey } from '@/lib/search-key'

async function requireManualMode(companyId: string): Promise<string | null> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { erpType: true },
  })
  if (settings?.erpType !== 'manual') {
    return 'Edição manual de clientes só é permitida quando o ERP está configurado como "Banco próprio do sistema".'
  }
  return null
}

async function ownsClient(companyId: string, id: string): Promise<boolean> {
  const c = await prisma.client.findUnique({ where: { id }, select: { companyId: true } })
  return c?.companyId === companyId
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const block = await requireManualMode(companyId)
  if (block) return NextResponse.json({ error: block }, { status: 403 })

  if (!(await ownsClient(companyId, params.id))) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  try {
    const body = await req.json()
    const { name, cpfCnpj, email, phone, whatsapp, status, city } = body

    if (name !== undefined && (!name || !String(name).trim())) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    // Carrega estado atual para recomputar searchKey com dados completos
    const current = await prisma.client.findUnique({
      where: { id: params.id },
      select: { name: true, cpfCnpj: true, whatsapp: true, phone: true },
    })
    const merged = {
      name: name !== undefined ? String(name).trim() : current!.name,
      cpfCnpj: cpfCnpj !== undefined ? (cpfCnpj?.trim() || null) : current!.cpfCnpj,
      whatsapp: whatsapp !== undefined ? (whatsapp?.trim() || null) : current!.whatsapp,
      phone: phone !== undefined ? (phone?.trim() || null) : current!.phone,
    }

    const client = await prisma.client.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(cpfCnpj !== undefined && { cpfCnpj: cpfCnpj?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(whatsapp !== undefined && { whatsapp: whatsapp?.trim() || null }),
        ...(status !== undefined && { status }),
        ...(city !== undefined && { city: city?.trim() || null }),
        searchKey: buildClientSearchKey(merged),
      },
    })

    return NextResponse.json({ ok: true, client })
  } catch (err) {
    console.error('[PUT /api/clientes/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const block = await requireManualMode(companyId)
  if (block) return NextResponse.json({ error: block }, { status: 403 })

  if (!(await ownsClient(companyId, params.id))) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  try {
    // Bloqueia exclusão se cliente tem faturas em aberto/vencidas
    const openInvoices = await prisma.invoice.count({
      where: { clientId: params.id, status: { in: ['aberta', 'vencida'] } },
    })
    if (openInvoices > 0) {
      return NextResponse.json({
        error: `Cliente possui ${openInvoices} fatura(s) em aberto. Quite ou cancele antes de excluir.`,
      }, { status: 409 })
    }

    await prisma.client.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/clientes/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
