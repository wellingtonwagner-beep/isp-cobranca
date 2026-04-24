import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'

async function requireManualMode(companyId: string): Promise<string | null> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { erpType: true },
  })
  if (settings?.erpType !== 'manual') {
    return 'CRUD manual de clientes só é permitido quando o ERP está configurado como "Banco próprio do sistema".'
  }
  return null
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const block = await requireManualMode(companyId)
  if (block) return NextResponse.json({ error: block }, { status: 403 })

  try {
    const body = await req.json()
    const { name, cpfCnpj, email, phone, whatsapp, status, city } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const client = await prisma.client.create({
      data: {
        companyId,
        name: name.trim(),
        cpfCnpj: cpfCnpj?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        status: status || 'ativo',
        city: city?.trim() || null,
      },
    })

    return NextResponse.json({ ok: true, client })
  } catch (err: unknown) {
    const error = err as { code?: string }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um cliente com esse identificador' }, { status: 409 })
    }
    console.error('[POST /api/clientes]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = req.nextUrl
    const q = searchParams.get('q') || ''
    const status = searchParams.get('status') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = 10

    const where: Record<string, unknown> = { companyId }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { cpfCnpj: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { whatsapp: { contains: q, mode: 'insensitive' } },
      ]
    }

    if (status) where.status = status

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { invoices: true, messageLogs: true } },
        },
      }),
      prisma.client.count({ where }),
    ])

    return NextResponse.json({ clients, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
