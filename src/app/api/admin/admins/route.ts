import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAdminSessionFromCookie } from '@/lib/admin-jwt'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const s = await getAdminSessionFromCookie()
  if (!s) return null
  return s
}

export async function GET() {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const admins = await prisma.adminUser.findMany({
    select: { id: true, email: true, name: true, active: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ admins })
}

export async function POST(req: NextRequest) {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  try {
    const { email, name, password } = await req.json() as { email?: string; name?: string; password?: string }
    if (!email || !name || !password) {
      return NextResponse.json({ error: 'E-mail, nome e senha são obrigatórios' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 8 caracteres' }, { status: 400 })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const admin = await prisma.adminUser.create({
      data: { email: email.trim().toLowerCase(), name: name.trim(), passwordHash },
      select: { id: true, email: true, name: true, active: true, createdAt: true },
    })
    return NextResponse.json({ ok: true, admin })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === 'P2002') return NextResponse.json({ error: 'Já existe admin com esse e-mail' }, { status: 409 })
    console.error('[POST /api/admin/admins]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
