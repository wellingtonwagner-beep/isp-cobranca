import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const q = searchParams.get('q') || ''
    const status = searchParams.get('status') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = 50

    const where: Record<string, unknown> = {}

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { cpfCnpj: { contains: q } },
        { phone: { contains: q } },
        { whatsapp: { contains: q } },
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
