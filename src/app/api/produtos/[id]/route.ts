/**
 * PUT    /api/produtos/[id]  — atualiza produto (somente erpType=manual)
 * DELETE /api/produtos/[id]  — remove produto (somente erpType=manual)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'
import { buildProductSearchKey } from '@/lib/search-key'

const VALID_RECURRENCE = ['once', 'monthly', 'yearly']

async function requireManualMode(companyId: string): Promise<string | null> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { erpType: true },
  })
  if (settings?.erpType !== 'manual') {
    return 'Edição de produtos só é permitida quando o ERP está configurado como "Banco próprio do sistema".'
  }
  return null
}

async function ownsProduct(companyId: string, id: string): Promise<boolean> {
  const p = await prisma.product.findUnique({ where: { id }, select: { companyId: true } })
  return p?.companyId === companyId
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const block = await requireManualMode(companyId)
  if (block) return NextResponse.json({ error: block }, { status: 403 })

  if (!(await ownsProduct(companyId, params.id))) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  try {
    const body = await req.json()
    const { name, description, amount, recurrence, active } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) {
      if (!name || !String(name).trim()) {
        return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
      }
      data.name = String(name).trim()
      data.searchKey = buildProductSearchKey({ name: data.name as string })
    }
    if (description !== undefined) data.description = description?.trim() || null
    if (amount !== undefined) {
      const n = Number(amount)
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
      data.amount = n
    }
    if (recurrence !== undefined) {
      if (!VALID_RECURRENCE.includes(recurrence)) {
        return NextResponse.json({ error: 'Recorrência inválida' }, { status: 400 })
      }
      data.recurrence = recurrence
    }
    if (active !== undefined) data.active = Boolean(active)

    const product = await prisma.product.update({ where: { id: params.id }, data })
    return NextResponse.json({ ok: true, product })
  } catch (err) {
    console.error('[PUT /api/produtos/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const block = await requireManualMode(companyId)
  if (block) return NextResponse.json({ error: block }, { status: 403 })

  if (!(await ownsProduct(companyId, params.id))) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  try {
    const subs = await prisma.subscription.count({
      where: { productId: params.id, active: true },
    })
    if (subs > 0) {
      return NextResponse.json({
        error: `Produto possui ${subs} assinatura(s) ativa(s). Desative-as antes de excluir, ou apenas desative o produto.`,
      }, { status: 409 })
    }

    await prisma.product.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/produtos/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
