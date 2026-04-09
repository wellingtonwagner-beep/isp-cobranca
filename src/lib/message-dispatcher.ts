import { prisma } from './prisma'
import { EvolutionClient } from './evolution'
import { renderTemplate } from './templates'
import { formatDateBR, formatCurrency } from './utils'
import type { Stage, MessageStatus } from '@/types'
import type { Client, Invoice } from '@prisma/client'

interface DispatchResult {
  status: MessageStatus
  evolutionMsgId?: string
  error?: string
}

export async function dispatchMessage(
  client: Client,
  invoice: Invoice,
  stage: Stage,
  testMode: boolean,
  evolutionClient: EvolutionClient | null,
  companySettings?: { companyWhatsapp?: string | null; companyHours?: string | null }
): Promise<DispatchResult> {
  // 1. Anti-duplicata
  const existing = await prisma.messageLog.findUnique({
    where: { invoiceId_stage: { invoiceId: invoice.id, stage } },
  })
  if (existing) return { status: 'blocked_duplicate' }

  // 2. Verifica número de WhatsApp
  if (!client.whatsapp) {
    await logMessage(client, invoice, stage, '', '', undefined, 'skipped_no_phone', testMode)
    return { status: 'skipped_no_phone' }
  }

  // 3. Renderiza template
  const vars = {
    nome: client.name.split(' ')[0],
    data_vencimento: formatDateBR(invoice.dueDate),
    valor: formatCurrency(invoice.amount),
    link_boleto: invoice.boletoUrl || undefined,
    codigo_pix: invoice.pixCode || undefined,
    company_whatsapp: companySettings?.companyWhatsapp || process.env.NEXT_PUBLIC_COMPANY_WHATSAPP || '',
    company_hours: companySettings?.companyHours || 'Seg-Sex 8h às 18h',
  }

  const { mainMessage, pixMessage } = renderTemplate(stage, vars)

  // 4. Modo teste
  if (testMode) {
    await logMessage(client, invoice, stage, mainMessage, pixMessage, undefined, 'blocked_test', testMode)
    return { status: 'blocked_test' }
  }

  // 5. Verifica se evolution está configurado
  if (!evolutionClient) {
    await logMessage(client, invoice, stage, mainMessage, pixMessage, undefined, 'failed', testMode, 'Evolution API não configurada')
    return { status: 'failed', error: 'Evolution API não configurada' }
  }

  // 6. Envia via Evolution API
  try {
    const res = await evolutionClient.sendText(client.whatsapp, mainMessage)
    let msgIds = res.key?.id || ''

    if (pixMessage && invoice.pixCode) {
      await new Promise((r) => setTimeout(r, 1500))
      const pixRes = await evolutionClient.sendText(client.whatsapp, invoice.pixCode)
      if (pixRes.key?.id) msgIds += `,${pixRes.key.id}`
    }

    await logMessage(client, invoice, stage, mainMessage, pixMessage, msgIds, 'sent', testMode)
    return { status: 'sent', evolutionMsgId: msgIds }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    await logMessage(client, invoice, stage, mainMessage, pixMessage, undefined, 'failed', testMode, errorMsg)
    return { status: 'failed', error: errorMsg }
  }
}

async function logMessage(
  client: Client,
  invoice: Invoice,
  stage: Stage,
  messageBody: string,
  pixBody: string | undefined,
  evolutionMsgId: string | undefined,
  status: MessageStatus,
  testMode: boolean,
  errorMessage?: string
) {
  try {
    await prisma.messageLog.create({
      data: {
        companyId: client.companyId,
        clientId: client.id,
        invoiceId: invoice.id,
        stage,
        whatsappTo: client.whatsapp || '',
        messageBody,
        pixBody: pixBody || null,
        status,
        evolutionMsgId: evolutionMsgId || null,
        testMode,
        errorMessage: errorMessage || null,
      },
    })
  } catch (err: unknown) {
    const error = err as { code?: string }
    if (error?.code !== 'P2002') {
      console.error('[MessageDispatcher] Erro ao salvar log:', err)
    }
  }
}
