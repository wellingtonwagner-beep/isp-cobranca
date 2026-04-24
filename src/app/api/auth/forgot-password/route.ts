/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Gera token de redefinicao (validade 1h) e loga o link no console do servidor.
 * Resposta sempre 200 ok=true (nao revela se o e-mail existe ou nao, por seguranca).
 *
 * O super-admin (definido em SUPER_ADMIN_EMAIL) ve o link nos logs do servidor.
 * No futuro, integrar com SMTP para envio automatico.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hora

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string }
    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true, email: true },
    })

    // Sempre responde sucesso para nao vazar quais e-mails existem
    if (!company) {
      console.log(`[forgot-password] Tentativa para e-mail nao cadastrado: ${email}`)
      return NextResponse.json({ ok: true, message: 'Se o e-mail estiver cadastrado, um link de redefinicao foi enviado.' })
    }

    // Invalida tokens anteriores nao usados desta empresa
    await prisma.passwordResetToken.updateMany({
      where: { companyId: company.id, used: false },
      data: { used: true },
    })

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

    await prisma.passwordResetToken.create({
      data: { companyId: company.id, token, expiresAt },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || req.headers.get('origin')
      || 'http://localhost:3000'
    const link = `${baseUrl}/redefinir-senha?token=${token}`

    console.log(`[forgot-password] Link de redefinicao para ${company.name} (${company.email}):`)
    console.log(`  ${link}`)
    console.log(`  Validade: ${expiresAt.toLocaleString('pt-BR')}`)

    return NextResponse.json({
      ok: true,
      message: 'Se o e-mail estiver cadastrado, um link de redefinicao foi gerado. Verifique os logs do servidor (em produção real, será enviado por e-mail).',
    })
  } catch (err) {
    console.error('[POST /api/auth/forgot-password]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
