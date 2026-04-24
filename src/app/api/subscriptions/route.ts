/**
 * GET  /api/subscriptions   — lista assinaturas da empresa
 * POST /api/subscriptions   — cria assinatura (somente erpType=manual)
 *
 * Uma assinatura liga um cliente a um produto recorrente; o cron diario
 * gera uma Invoice a cada mes (ou ano) no dia configurado.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'

async function requireManualMode(companyId: string): Promise<string | null> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { erpType: true },
  })
  if (settings?.erpType !== 'manual') {
    return 'Gestão de assinaturas só é permitida no modo "Banco próprio do sistema".'
  }
  return null
}

export async function GET(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = req.nextUrl
    const includeInactive = searchParams.get('includeInactive') === '1'
    const clientId = searchParams.get('clientId')

    const where: Record<string, unknown> = { companyId }
    if (!includeInactive) where.active = true
    if (clientId) where.clientId = clientId

    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      include: {
        client: { select: { id: true, name: true, whatsapp: true } },
        product: { select: { id: true, name: true, amount: true, recurrence: true } },
        _count: { select: { invoices: true } },
      },
    })
    return NextResponse.json({ subscriptions })
  } catch (err) {
    console.error('[GET /api/subscriptions]', err)
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
    const { clientId, productId, dayOfMonth, startDate, endDate, active } = body

    if (!clientId) return NextResponse.json({ error: 'Cliente é obrigatório' }, { status: 400 })
    if (!productId) return NextResponse.json({ error: 'Produto é obrigatório' }, { status: 400 })
    const day = parseInt(String(dayOfMonth))
    if (!day || day < 1 || day > 31) {
      return NextResponse.json({ error: 'Dia do mês deve estar entre 1 e 31' }, { status: 400 })
    }
    if (!startDate) return NextResponse.json({ error: 'Data de início é obrigatória' }, { status: 400 })

    // Valida cliente e produto pertencem a empresa
    const [client, product] = await Promise.all([
      prisma.client.findFirst({ where: { id: clientId, companyId }, select: { id: true } }),
      prisma.product.findFirst({
        where: { id: productId, companyId },
        select: { id: true, recurrence: true, active: true },
      }),
    ])
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    if (!product.active) return NextResponse.json({ error: 'Produto está inativo' }, { status: 400 })
    if (product.recurrence === 'once') {
      return NextResponse.json({
        error: 'Produto é do tipo "Avulso" e não pode gerar assinaturas recorrentes',
      }, { status: 400 })
    }

    const subscription = await prisma.subscription.create({
      data: {
        companyId,
        clientId,
        productId,
        dayOfMonth: day,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: endDate ? new Date(`${endDate}T23:59:59.999Z`) : null,
        active: active ?? true,
      },
      include: {
        client: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, amount: true } },
      },
    })

    return NextResponse.json({ ok: true, subscription })
  } catch (err) {
    console.error('[POST /api/subscriptions]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
