/**
 * GET  /api/admin-auth/setup  — retorna { needsSetup: boolean }
 * POST /api/admin-auth/setup  — cria o PRIMEIRO admin (so funciona se nao existe nenhum)
 *
 * Body POST: { email, name, password }
 * Depois de criado, rota fica bloqueada (retorna 403).
 */
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const count = await prisma.adminUser.count()
  return NextResponse.json({ needsSetup: count === 0 })
}

export async function POST(req: NextRequest) {
  const count = await prisma.adminUser.count()
  if (count > 0) {
    return NextResponse.json({
      error: 'Setup já foi concluído. Use o login normal ou peça a um admin existente para criar seu acesso.',
    }, { status: 403 })
  }

  try {
    const { email, name, password } = await req.json() as { email?: string; name?: string; password?: string }
    if (!email || !name || !password) {
      return NextResponse.json({ error: 'E-mail, nome e senha são obrigatórios' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 8 caracteres' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const admin = await prisma.adminUser.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    })

    console.log(`[admin-setup] Primeiro super-admin criado: ${admin.email}`)

    return NextResponse.json({ ok: true, admin })
  } catch (err: unknown) {
    const error = err as { code?: string }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe admin com esse e-mail' }, { status: 409 })
    }
    console.error('[POST /api/admin-auth/setup]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
