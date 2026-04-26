/**
 * POST /api/admin/test-psp
 *
 * Tenta autenticar com o PSP configurado e retorna mensagem de diagnostico
 * para a tela de Configuracoes > PIX.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'
import { createPspClient } from '@/lib/psp'

export async function POST() {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: {
      pixPsp: true,
      pixPspApiKey: true,
      pixPspClientId: true,
      pixPspClientSecret: true,
      pixPspWebhookSecret: true,
      pixPspBaseUrl: true,
      pixPspEnv: true,
      pixPspCertBase64: true,
      pixPspCertPassword: true,
    },
  })

  if (!settings?.pixPsp) {
    return NextResponse.json({ ok: false, message: 'Selecione um PSP antes de testar.' })
  }

  const client = createPspClient(settings)
  if (!client) {
    return NextResponse.json({ ok: false, message: `PSP "${settings.pixPsp}" ainda nao tem integracao implementada.` })
  }

  try {
    const result = await client.testConnection()
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ ok: false, message: e.message || 'Erro desconhecido' })
  }
}
