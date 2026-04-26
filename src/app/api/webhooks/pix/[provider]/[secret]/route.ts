/**
 * POST /api/webhooks/pix/[provider]/[secret]
 *
 * Endpoint publico (sem auth de sessao) que recebe notificacoes de pagamento
 * dos PSPs. A autenticacao e' feita pelo `secret` no path: cada empresa tem
 * um pixPspWebhookSecret unico, e so a empresa cuja secret bate recebe o
 * pagamento. Defesa basica contra spoofing — para producao real, recomenda-se
 * tambem validar IP de origem e mTLS.
 *
 * Idempotente: se a invoice ja esta paga, ignora o evento mas retorna 200
 * para o PSP nao continuar tentando.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPspClient } from '@/lib/psp'

export async function POST(
  req: NextRequest,
  context: { params: { provider: string; secret: string } },
) {
  const { provider, secret } = context.params

  if (!secret || secret.length < 8) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 400 })
  }

  // Acha a empresa pelo webhookSecret + provider.
  const settings = await prisma.companySettings.findFirst({
    where: { pixPsp: provider, pixPspWebhookSecret: secret },
    select: {
      companyId: true,
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

  if (!settings) {
    console.warn(`[webhook/pix] Secret invalido para provider=${provider}`)
    return NextResponse.json({ error: 'Unknown webhook' }, { status: 404 })
  }

  const client = createPspClient(settings)
  if (!client) {
    console.error(`[webhook/pix] Provider ${provider} sem adapter`)
    return NextResponse.json({ error: 'Provider not implemented' }, { status: 501 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const events = client.parseWebhook(body)
  if (events.length === 0) {
    // Pode ser ping de validacao do PSP. Responde 200 pra nao gerar retry.
    console.log(`[webhook/pix][${settings.companyId}] Body sem eventos pix (provavel ping):`, JSON.stringify(body).slice(0, 200))
    return NextResponse.json({ ok: true, processed: 0 })
  }

  let processed = 0
  let alreadyPaid = 0
  let notFound = 0

  for (const ev of events) {
    const invoice = await prisma.invoice.findFirst({
      where: { companyId: settings.companyId, pixTxid: ev.txid },
      select: { id: true, status: true, amount: true },
    })
    if (!invoice) {
      notFound++
      console.warn(`[webhook/pix][${settings.companyId}] TXID ${ev.txid} nao encontrado em invoices`)
      continue
    }
    if (invoice.status === 'paga') {
      alreadyPaid++
      continue
    }
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'paga',
        paidAt: ev.paidAt,
        paidVia: 'webhook_pix',
        paymentNote: `e2e=${ev.e2eId}${ev.payerName ? ` pagador=${ev.payerName}` : ''}`,
      },
    })
    processed++
  }

  console.log(`[webhook/pix][${settings.companyId}] provider=${provider} processed=${processed} alreadyPaid=${alreadyPaid} notFound=${notFound}`)
  return NextResponse.json({ ok: true, processed, alreadyPaid, notFound })
}

// Alguns PSPs (incluindo C6/Sicoob) validam o webhook fazendo um GET ou HEAD
// na URL antes de cadastrar. Responder 200 evita rejeicao no cadastro.
export async function GET() {
  return NextResponse.json({ ok: true })
}
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
