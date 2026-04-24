/**
 * PUT    /api/subscriptions/[id]  — edita assinatura (somente erpType=manual)
 * DELETE /api/subscriptions/[id]  — desativa (soft delete: active=false)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'

async function requireManualMode(companyId: string): Promise<string | null> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId }, select: { erpType: true },
  })
  if (settings?.erpType !== 'manual') {
    return 'Gestão de assinaturas só é permitida no modo "Banco próprio do sistema".'
  }
  return null
}

async function ownsSubscription(companyId: string, id: string): Promise<boolean> {
  const s = await prisma.subscription.findUnique({ where: { id }, select: { companyId: true } })
  return s?.companyId === companyId
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const block = await requireManualMode(companyId)
  if (block) return NextResponse.json({ error: block }, { status: 403 })

  if (!(await ownsSubscription(companyId, params.id))) {
    return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })
  }

  try {
    const body = await req.json()
    const { dayOfMonth, startDate, endDate, active } = body

    const data: Record<string, unknown> = {}
    if (dayOfMonth !== undefined) {
      const day = parseInt(String(dayOfMonth))
      if (!day || day < 1 || day > 31) {
        return NextResponse.json({ error: 'Dia do mês inválido' }, { status: 400 })
      }
      data.dayOfMonth = day
    }
    if (startDate !== undefined) data.startDate = new Date(`${startDate}T00:00:00.000Z`)
    if (endDate !== undefined) data.endDate = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null
    if (active !== undefined) data.active = Boolean(active)

    const subscription = await prisma.subscription.update({ where: { id: params.id }, data })
    return NextResponse.json({ ok: true, subscription })
  } catch (err) {
    console.error('[PUT /api/subscriptions/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const block = await requireManualMode(companyId)
  if (block) return NextResponse.json({ error: block }, { status: 403 })

  if (!(await ownsSubscription(companyId, params.id))) {
    return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })
  }

  try {
    // Soft delete: desativa ao inves de remover, preservando as faturas geradas
    const subscription = await prisma.subscription.update({
      where: { id: params.id },
      data: { active: false, endDate: new Date() },
    })
    return NextResponse.json({ ok: true, subscription })
  } catch (err) {
    console.error('[DELETE /api/subscriptions/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
