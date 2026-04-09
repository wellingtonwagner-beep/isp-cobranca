import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { name, cnpj, email, password, logo } = await req.json()

    if (!name || !cnpj || !email || !password) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 8 caracteres.' }, { status: 400 })
    }

    const rawCnpj = cnpj.replace(/\D/g, '')
    if (rawCnpj.length !== 14) {
      return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 })
    }

    // Verifica duplicidade
    const existing = await prisma.company.findFirst({
      where: { OR: [{ cnpj: rawCnpj }, { email: email.toLowerCase() }] },
    })

    if (existing) {
      const field = existing.cnpj === rawCnpj ? 'CNPJ' : 'e-mail'
      return NextResponse.json({ error: `Já existe uma conta com este ${field}.` }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const company = await prisma.company.create({
      data: {
        name,
        cnpj: rawCnpj,
        email: email.toLowerCase(),
        passwordHash,
        logo: logo || null,
        // Cria as configurações padrão junto
        settings: {
          create: {
            testMode: true,
          },
        },
      },
    })

    return NextResponse.json({ ok: true, id: company.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/companies]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
