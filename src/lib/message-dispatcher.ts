import { prisma } from './prisma'
import { evolution } from './evolution'
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
  testMode: boolean
): Promise<DispatchResult> {
  // 1. Anti-duplicata: verifica se já foi enviado
  const existing = await prisma.messageLog.findUnique({
    where: { invoiceId_stage: { invoiceId: invoice.id, stage } },
  })

  if (existing) {
    return { status: 'blocked_duplicate' }
  }

  // 2. Verifica número de WhatsApp
  if (!client.whatsapp) {
    await logMessage(client, invoice, stage, '', '', undefined, 'skipped_no_phone', testMode)
    return { status: 'skipped_no_phone' }
  }

  // 3. Renderiza template
  const vars = {
    nome: client.name.split(' ')[0], // Primeiro nome
    data_vencimento: formatDateBR(invoice.dueDate),
    valor: formatCurrency(invoice.amount),
    link_boleto: invoice.boletoUrl || undefined,
    codigo_pix: invoice.pixCode || undefined,
  }

  const { mainMessage, pixMessage } = renderTemplate(stage, vars)

  // 4. Modo teste — não envia, apenas loga
  if (testMode) {
    await logMessage(client, invoice, stage, mainMessage, pixMessage, undefined, 'blocked_test', testMode)
    return { status: 'blocked_test' }
  }

  // 5. Envia via Evolution API
  try {
    const res = await evolution.sendText(client.whatsapp, mainMessage)
    let msgIds = res.key?.id || ''

    // Envia PIX como segunda mensagem se disponível
    if (pixMessage && invoice.pixCode) {
      await new Promise((r) => setTimeout(r, 1500))
      const pixRes = await evolution.sendText(client.whatsapp, invoice.pixCode)
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
    // Pode ser duplicata por race condition — ignorar silenciosamente
    const error = err as { code?: string }
    if (error?.code !== 'P2002') {
      console.error('[MessageDispatcher] Erro ao salvar log:', err)
    }
  }
}
