import { NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createEvolutionClient } from '@/lib/evolution'

export async function GET() {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const settings = await prisma.companySettings.findUnique({ where: { companyId } })
    const client = createEvolutionClient(settings || {})

    if (!client) {
      return NextResponse.json({ ok: false, error: 'Evolution API não configurada. Preencha URL, API Key e Instância.' })
    }

    const connected = await client.checkConnection()
    return NextResponse.json({
      ok: connected,
      status: connected ? 'Conectado' : 'Desconectado',
      message: connected
        ? 'WhatsApp conectado e pronto para enviar mensagens.'
        : 'Instância desconectada. Verifique se o WhatsApp está escaneado na Evolution API.',
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
