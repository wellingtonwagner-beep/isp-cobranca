import { prisma } from './prisma'
import { EvolutionClient } from './evolution'
import { renderTemplate, CustomTemplates } from './templates'
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
  companySettings?: { companyName?: string | null; companyWhatsapp?: string | null; companyHours?: string | null },
  customTemplates?: CustomTemplates,
  options?: { force?: boolean },
): Promise<DispatchResult> {
  // 1. Anti-duplicata (ignorada quando force=true)
  //    Cria log "pending" imediatamente para bloquear execuções concorrentes.
  //    Se outra execução já criou o log, P2002 é lançado -> retorna blocked_duplicate.
  let pendingLogId: string | null = null
  if (!options?.force) {
    try {
      const pendingLog = await prisma.messageLog.create({
        data: {
          companyId: client.companyId,
          clientId: client.id,
          invoiceId: invoice.id,
          stage,
          whatsappTo: client.whatsapp || '',
          messageBody: '',
          status: 'pending',
          testMode,
        },
      })
      pendingLogId = pendingLog.id
    } catch (err: unknown) {
      const error = err as { code?: string }
      if (error?.code === 'P2002') return { status: 'blocked_duplicate' }
      throw err
    }

    // 1b. Safety net adicional: se cliente já recebeu mensagem 'sent' HOJE, pula
    //     (protege contra duplicatas mesmo em estágios diferentes no mesmo dia)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const sentToday = await prisma.messageLog.findFirst({
      where: {
        clientId: client.id,
        status: 'sent',
        sentAt: { gte: todayStart },
        id: { not: pendingLogId },
      },
    })
    if (sentToday) {
      await prisma.messageLog.update({
        where: { id: pendingLogId },
        data: { status: 'blocked_duplicate', errorMessage: 'Cliente já recebeu mensagem hoje' },
      })
      return { status: 'blocked_duplicate' }
    }
  } else {
    // Em envio forçado (manual), remove log antigo para permitir novo envio
    await prisma.messageLog.deleteMany({
      where: { invoiceId: invoice.id, stage },
    })
  }

  // 2. Verifica número de WhatsApp
  if (!client.whatsapp) {
    if (pendingLogId) {
      await prisma.messageLog.update({
        where: { id: pendingLogId },
        data: { status: 'skipped_no_phone' },
      })
    } else {
      await logMessage(client, invoice, stage, '', '', undefined, 'skipped_no_phone', testMode)
    }
    return { status: 'skipped_no_phone' }
  }

  // 3. Renderiza template
  const vars = {
    nome: client.name.split(' ')[0],
    data_vencimento: formatDateBR(invoice.dueDate),
    valor: formatCurrency(invoice.amount),
    link_boleto: invoice.boletoUrl || undefined,
    codigo_pix: invoice.pixCode || undefined,
    company_name: companySettings?.companyName || process.env.NEXT_PUBLIC_COMPANY_NAME || 'sua operadora',
    company_whatsapp: companySettings?.companyWhatsapp || process.env.NEXT_PUBLIC_COMPANY_WHATSAPP || '',
    company_hours: companySettings?.companyHours || 'Seg-Sex 8h às 18h',
  }

  const { mainMessage, pixMessage } = renderTemplate(stage, vars, customTemplates)

  // Helper: atualiza o pending log OU cria novo (caso force=true)
  async function finalizeLog(status: MessageStatus, msgId?: string, errorMessage?: string) {
    if (pendingLogId) {
      await prisma.messageLog.update({
        where: { id: pendingLogId },
        data: {
          messageBody: mainMessage,
          pixBody: pixMessage || null,
          status,
          evolutionMsgId: msgId || null,
          errorMessage: errorMessage || null,
          sentAt: new Date(),
        },
      })
    } else {
      await logMessage(client, invoice, stage, mainMessage, pixMessage, msgId, status, testMode, errorMessage)
    }
  }

  // 4. Modo teste
  if (testMode) {
    await finalizeLog('blocked_test')
    return { status: 'blocked_test' }
  }

  // 5. Verifica se evolution está configurado
  if (!evolutionClient) {
    await finalizeLog('failed', undefined, 'Evolution API não configurada')
    return { status: 'failed', error: 'Evolution API não configurada' }
  }

  // 6. Envia via Evolution API
  try {
    const res = await evolutionClient.sendText(client.whatsapp, mainMessage)
    let msgIds = res.key?.id || ''

    if (pixMessage) {
      await new Promise((r) => setTimeout(r, 1500))
      const pixRes = await evolutionClient.sendText(client.whatsapp, pixMessage)
      if (pixRes.key?.id) msgIds += `,${pixRes.key.id}`
    }

    await finalizeLog('sent', msgIds)
    return { status: 'sent', evolutionMsgId: msgIds }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    await finalizeLog('failed', undefined, errorMsg)
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
