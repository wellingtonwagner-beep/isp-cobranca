/**
 * GET  /api/produtos          — lista produtos da empresa
 * POST /api/produtos          — cria produto (somente erpType=manual)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'

const VALID_RECURRENCE = ['once', 'monthly', 'yearly']

async function requireManualMode(companyId: string): Promise<string | null> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { erpType: true },
  })
  if (settings?.erpType !== 'manual') {
    return 'Cadastro de produtos só é permitido quando o ERP está configurado como "Banco próprio do sistema".'
  }
  return null
}

export async function GET(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = req.nextUrl
    const includeInactive = searchParams.get('includeInactive') === '1'
    const products = await prisma.product.findMany({
      where: { companyId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { name: 'asc' },
      include: { _count: { select: { invoices: true, subscriptions: true } } },
    })
    return NextResponse.json({ products })
  } catch (err) {
    console.error('[GET /api/produtos]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const block = await requireManualMode(companyId)
  if (block) return NextResponse.json({ error: block }, { status: 403 })

  try {
    const body = await req.json()
    const { name, description, amount, recurrence, active } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }
    const rec = recurrence && VALID_RECURRENCE.includes(recurrence) ? recurrence : 'once'

    const product = await prisma.product.create({
      data: {
        companyId,
        name: String(name).trim(),
        description: description?.trim() || null,
        amount: amountNum,
        recurrence: rec,
        active: active ?? true,
      },
    })

    return NextResponse.json({ ok: true, product })
  } catch (err) {
    console.error('[POST /api/produtos]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
