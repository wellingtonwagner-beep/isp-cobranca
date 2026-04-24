import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAdminSessionFromCookie } from '@/lib/admin-jwt'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getAdminSessionFromCookie()
  if (!s) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  try {
    const body = await req.json() as { active?: boolean; password?: string; name?: string }
    const data: Record<string, unknown> = {}
    if (body.active !== undefined) data.active = Boolean(body.active)
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.password !== undefined) {
      if (body.password.length < 8) {
        return NextResponse.json({ error: 'Senha deve ter no mínimo 8 caracteres' }, { status: 400 })
      }
      data.passwordHash = await bcrypt.hash(body.password, 12)
    }
    // Evita o admin logado se desativar / zerar a si mesmo sem querer
    if (params.id === s.adminId && body.active === false) {
      return NextResponse.json({ error: 'Não é possível desativar o próprio usuário' }, { status: 400 })
    }

    const admin = await prisma.adminUser.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, name: true, active: true },
    })
    return NextResponse.json({ ok: true, admin })
  } catch (err) {
    console.error('[PATCH /api/admin/admins/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getAdminSessionFromCookie()
  if (!s) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  if (params.id === s.adminId) {
    return NextResponse.json({ error: 'Não é possível excluir o próprio usuário' }, { status: 400 })
  }

  // Garante que sempre reste ao menos um admin ativo
  const totalActive = await prisma.adminUser.count({ where: { active: true, id: { not: params.id } } })
  if (totalActive === 0) {
    return NextResponse.json({ error: 'Deve existir ao menos um administrador ativo' }, { status: 400 })
  }

  try {
    await prisma.adminUser.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/admin/admins/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
