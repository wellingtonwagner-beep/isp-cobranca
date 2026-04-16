import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await prisma.client.findFirst({
      where: { id: params.id, companyId },
    })
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        clientId: client.id,
        status: { in: ['aberta', 'vencida'] },
      },
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        externalId: true,
        dueDate: true,
        amount: true,
        status: true,
        boletoUrl: true,
        pixCode: true,
      },
    })

    return NextResponse.json({ client, invoices })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
