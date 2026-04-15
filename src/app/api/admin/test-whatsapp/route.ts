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

    const details = await client.getConnectionDetails()

    if (details.state === 'open') {
      return NextResponse.json({
        ok: true,
        state: 'open',
        message: 'WhatsApp conectado e pronto para enviar mensagens.',
      })
    }

    if (details.state === 'not_found') {
      return NextResponse.json({
        ok: false,
        state: 'not_found',
        message: 'Instância não encontrada. Clique em "Conectar WhatsApp" para criar e escanear o QR Code.',
      })
    }

    // close, connecting, etc.
    return NextResponse.json({
      ok: false,
      state: details.state,
      message: `WhatsApp desconectado (estado: ${details.state}). Clique em "Conectar WhatsApp" para escanear o QR Code.`,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
