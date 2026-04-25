/**
 * GET  /api/invoices/manual   — lista faturas com filtros
 * POST /api/invoices/manual   — cria fatura avulsa (somente erpType=manual)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'
import { randomBytes } from 'crypto'

async function requireManualMode(companyId: string): Promise<string | null> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { erpType: true },
  })
  if (settings?.erpType !== 'manual') {
    return 'Criação de faturas só é permitida quando o ERP está configurado como "Banco próprio do sistema".'
  }
  return null
}

// TXID PIX: 25-35 chars alfanumericos. Placeholder ate F2 conectar PSP real.
function generateTxid(): string {
  return randomBytes(16).toString('hex').substring(0, 26).toUpperCase()
}

export async function GET(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = req.nextUrl
    const status = searchParams.get('status') || ''
    const clientId = searchParams.get('clientId') || ''
    const q = searchParams.get('q') || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = 10

    const where: Record<string, unknown> = { companyId }
    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (q) where.client = { name: { contains: q, mode: 'insensitive' } }
    if (from || to) {
      const dueDate: Record<string, Date> = {}
      if (from) dueDate.gte = new Date(`${from}T00:00:00.000Z`)
      if (to) dueDate.lte = new Date(`${to}T23:59:59.999Z`)
      where.dueDate = dueDate
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          client: { select: { id: true, name: true, whatsapp: true, cpfCnpj: true } },
          product: { select: { id: true, name: true, recurrence: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ])

    return NextResponse.json({ invoices, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('[GET /api/invoices/manual]', err)
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
    const { clientId, productId, amount, dueDate, description } = body

    if (!clientId) return NextResponse.json({ error: 'Cliente é obrigatório' }, { status: 400 })
    if (!dueDate) return NextResponse.json({ error: 'Data de vencimento é obrigatória' }, { status: 400 })
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Valor deve ser maior que zero' }, { status: 400 })
    }

    // Valida que o cliente pertence a empresa
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId },
      select: { id: true, name: true, planName: true },
    })
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

    // Produto é opcional; se informado, valida empresa
    let planName: string | null = client.planName
    if (productId) {
      const product = await prisma.product.findFirst({
        where: { id: productId, companyId },
        select: { name: true },
      })
      if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
      planName = product.name
    }

    // Proximo sequentialNumber da empresa
    const last = await prisma.invoice.findFirst({
      where: { companyId, sequentialNumber: { not: null } },
      orderBy: { sequentialNumber: 'desc' },
      select: { sequentialNumber: true },
    })
    const nextSeq = (last?.sequentialNumber || 0) + 1

    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        clientId,
        productId: productId || null,
        dueDate: new Date(`${dueDate}T00:00:00.000Z`),
        amount: amountNum,
        status: 'aberta',
        planName,
        description: description?.trim() || null,
        sequentialNumber: nextSeq,
        pixTxid: generateTxid(),
      },
      include: {
        client: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ ok: true, invoice })
  } catch (err) {
    console.error('[POST /api/invoices/manual]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
