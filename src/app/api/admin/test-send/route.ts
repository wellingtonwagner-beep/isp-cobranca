import { NextRequest, NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createEvolutionClient } from '@/lib/evolution'
import { normalizePhone } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { phone, message } = await req.json() as { phone: string; message?: string }

    if (!phone) {
      return NextResponse.json({ error: 'Informe o número de telefone.' }, { status: 400 })
    }

    const normalized = normalizePhone(phone)
    if (!normalized) {
      return NextResponse.json({ error: 'Número inválido. Use formato: (37) 99999-9999 ou 37999999999' }, { status: 400 })
    }

    const settings = await prisma.companySettings.findUnique({ where: { companyId } })
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
    const client = createEvolutionClient(settings || {})

    if (!client) {
      return NextResponse.json({ error: 'Evolution API não configurada.' }, { status: 400 })
    }

    const connected = await client.checkConnection()
    if (!connected) {
      return NextResponse.json({ error: 'WhatsApp desconectado. Conecte primeiro na aba WhatsApp.' }, { status: 400 })
    }

    const testMessage = message || [
      `Mensagem de teste - ${company?.name || 'ISP Cobrança'}`,
      '',
      'Se você recebeu esta mensagem, o sistema de cobrança via WhatsApp está funcionando corretamente!',
      '',
      `Enviado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    ].join('\n')

    const res = await client.sendText(normalized, testMessage)

    return NextResponse.json({
      ok: true,
      message: `Mensagem enviada com sucesso para ${normalized}!`,
      evolutionMsgId: res.key?.id,
    })
  } catch (err) {
    console.error('[POST /api/admin/test-send]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
