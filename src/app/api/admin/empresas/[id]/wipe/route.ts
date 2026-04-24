/**
 * POST /api/admin/empresas/[id]/wipe
 * Apaga TODOS os dados operacionais de uma empresa, preservando:
 *   - Company (a empresa em si)
 *   - CompanySettings (credenciais e configuracao)
 *
 * Apaga em cascata: messageLogs -> invoices -> subscriptions -> products
 *                  -> holidays -> configs -> clients
 *
 * Requer:
 *   - super-admin (SUPER_ADMIN_EMAIL)
 *   - body { confirm: string } com o nome EXATO da empresa
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromCookie } from '@/lib/admin-jwt'
import { prisma } from '@/lib/prisma'

async function requireSuperAdmin() {
  const session = await getAdminSessionFromCookie()
  if (!session) return { ok: false as const, status: 401 }
  return { ok: true as const, session }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  })
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as { confirm?: string }
  if (!body.confirm || body.confirm.trim() !== company.name) {
    return NextResponse.json({
      error: `Para confirmar, envie o nome exato: "${company.name}"`,
    }, { status: 400 })
  }

  const companyId = company.id

  // Ordem importante: respeita as foreign keys.
  // messageLogs -> invoices (FK), depois subscriptions (FK em invoices),
  // products (FK em invoices+subs), depois clients (FK em invoices+subs+logs).
  const deleted = await prisma.$transaction(async (tx) => {
    const ml = await tx.messageLog.deleteMany({ where: { companyId } })
    const inv = await tx.invoice.deleteMany({ where: { companyId } })
    const sub = await tx.subscription.deleteMany({ where: { companyId } })
    const prod = await tx.product.deleteMany({ where: { companyId } })
    const hol = await tx.holiday.deleteMany({ where: { companyId } })
    const cfg = await tx.config.deleteMany({ where: { companyId } })
    const cli = await tx.client.deleteMany({ where: { companyId } })
    return {
      messageLogs: ml.count,
      invoices: inv.count,
      subscriptions: sub.count,
      products: prod.count,
      holidays: hol.count,
      configs: cfg.count,
      clients: cli.count,
    }
  })

  console.log(`[admin/wipe] Empresa ${company.name} (${companyId}) limpa por ${auth.session.email}:`, deleted)

  return NextResponse.json({
    ok: true,
    company: company.name,
    deleted,
    message: `Dados de "${company.name}" foram apagados. Empresa e configurações preservadas.`,
  })
}
