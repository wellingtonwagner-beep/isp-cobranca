import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signAdminToken, ADMIN_COOKIE_NAME } from '@/lib/admin-jwt'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as { email?: string; password?: string }
    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 })
    }

    const admin = await prisma.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    })
    if (!admin || !admin.active) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, admin.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    })

    const token = await signAdminToken({
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      type: 'admin',
    })

    const res = NextResponse.json({ ok: true, admin: { id: admin.id, email: admin.email, name: admin.name } })
    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    })
    return res
  } catch (err) {
    console.error('[POST /api/admin-auth/login]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
