/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 *
 * Valida o token (existencia, validade, nao usado), atualiza a senha
 * (bcrypt salt 12) e marca o token como usado.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json() as { token?: string; password?: string }

    if (!token) return NextResponse.json({ error: 'Token é obrigatório' }, { status: 400 })
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 })
    }

    const reset = await prisma.passwordResetToken.findUnique({ where: { token } })
    if (!reset) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    if (reset.used) return NextResponse.json({ error: 'Este token já foi utilizado' }, { status: 400 })
    if (reset.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token expirado. Solicite um novo link.' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.$transaction([
      prisma.company.update({
        where: { id: reset.companyId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { used: true },
      }),
    ])

    return NextResponse.json({ ok: true, message: 'Senha redefinida com sucesso. Faça login com a nova senha.' })
  } catch (err) {
    console.error('[POST /api/auth/reset-password]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
