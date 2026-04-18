import { NextRequest, NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createEvolutionClient } from '@/lib/evolution'
import { dispatchMessage } from '@/lib/message-dispatcher'
import type { Stage } from '@/types'
import type { CustomTemplates } from '@/lib/templates'

const VALID_STAGES: Stage[] = [
  'D_MINUS_5', 'D_MINUS_2', 'D_ZERO',
  'D_PLUS_1', 'D_PLUS_5', 'D_PLUS_10', 'D_PLUS_14',
]

export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { clientId, invoiceId, stage, force, testMode: forceTestMode } =
      await req.json() as {
        clientId: string
        invoiceId: string
        stage: Stage
        force?: boolean
        testMode?: boolean
      }

    if (!clientId || !invoiceId || !stage) {
      return NextResponse.json({ error: 'Informe clientId, invoiceId e stage.' }, { status: 400 })
    }
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: 'Stage inválido.' }, { status: 400 })
    }

    const [client, invoice, settings, company] = await Promise.all([
      prisma.client.findFirst({ where: { id: clientId, companyId } }),
      prisma.invoice.findFirst({ where: { id: invoiceId, companyId, clientId } }),
      prisma.companySettings.findUnique({ where: { companyId } }),
      prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    ])

    if (!client) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })

    const evolutionClient = createEvolutionClient(settings || {})
    const testMode = forceTestMode ?? settings?.testMode ?? true

    let customTemplates: CustomTemplates | undefined
    if (settings?.templatesJson) {
      try { customTemplates = JSON.parse(settings.templatesJson) as CustomTemplates }
      catch { /* ignora template inválido */ }
    }

    const result = await dispatchMessage(
      client,
      invoice,
      stage,
      testMode,
      evolutionClient,
      { companyName: company?.name, companyWhatsapp: settings?.companyWhatsapp, companyHours: settings?.companyHours },
      customTemplates,
      { force: force ?? true },
    )

    const messages: Record<string, string> = {
      sent: `Mensagem enviada com sucesso para ${client.name}!`,
      blocked_test: `Modo teste ativo - mensagem registrada mas não enviada.`,
      blocked_duplicate: `Mensagem já foi enviada anteriormente neste estágio.`,
      skipped_no_phone: `Cliente não possui WhatsApp cadastrado.`,
      failed: `Falha ao enviar: ${result.error || 'erro desconhecido'}`,
    }

    return NextResponse.json({
      ok: result.status === 'sent' || result.status === 'blocked_test',
      status: result.status,
      message: messages[result.status] || result.status,
      evolutionMsgId: result.evolutionMsgId,
      testMode,
    })
  } catch (err) {
    console.error('[POST /api/admin/send-billing]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
