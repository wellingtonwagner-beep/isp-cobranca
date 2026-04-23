/**
 * GET  /api/admin/empresas       — lista todas as empresas (super-admin)
 * PATCH /api/admin/empresas      — atualiza plano de uma empresa { id, plan }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { PLAN_FEATURES, type Plan } from '@/lib/plans'

async function requireSuperAdmin() {
  const session = await getSessionFromCookie()
  if (!session) return { ok: false as const, status: 401 }
  const expected = process.env.SUPER_ADMIN_EMAIL
  if (!expected || session.email !== expected) return { ok: false as const, status: 403 }
  return { ok: true as const, session }
}

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      cnpj: true,
      email: true,
      plan: true,
      active: true,
      createdAt: true,
      _count: { select: { clients: true, invoices: true, messageLogs: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ companies })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  try {
    const { id, plan, active } = await req.json() as { id: string; plan?: Plan; active?: boolean }
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    const data: { plan?: Plan; active?: boolean } = {}
    if (plan) {
      if (!PLAN_FEATURES[plan]) return NextResponse.json({ error: 'plan inválido' }, { status: 400 })
      data.plan = plan
    }
    if (typeof active === 'boolean') data.active = active

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'nada para atualizar' }, { status: 400 })
    }

    const company = await prisma.company.update({
      where: { id },
      data,
      select: { id: true, name: true, plan: true, active: true },
    })

    return NextResponse.json({ ok: true, company })
  } catch (err) {
    console.error('[PATCH /api/admin/empresas]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
