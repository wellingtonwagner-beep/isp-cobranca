import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken, COOKIE_NAME } from '@/lib/jwt'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha obrigatórios.' }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!company || !company.active) {
      return NextResponse.json({ error: 'E-mail ou senha inválidos.' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, company.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'E-mail ou senha inválidos.' }, { status: 401 })
    }

    // Logo excluída do JWT para não inflar o cookie (HTTP/2 HPACK limit)
    const token = await signToken({
      companyId: company.id,
      email: company.email,
      name: company.name,
    })

    const res = NextResponse.json({ ok: true, name: company.name })
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      path: '/',
    })

    return res
  } catch (err) {
    console.error('[POST /api/auth/login]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
