import { prisma } from './prisma'
import { EvolutionClient } from './evolution'
import { renderTemplate, renderConsolidatedTemplate, CustomTemplates } from './templates'
import { formatDateBR, formatCurrency } from './utils'
import type { Stage, MessageStatus, InvoiceItem } from '@/types'
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
    // Faturas diferentes do mesmo cliente PODEM receber mensagens no mesmo dia.
    // A constraint @@unique([invoiceId, stage]) ja impede duplicar a mesma fatura
    // no mesmo estagio; o lock de /api/admin/cron impede cliques duplos no Disparar.
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

  // 3. Renderiza template — valor já formatado SEM "R$" (template adiciona)
  const vars = {
    nome: client.name.split(' ')[0],
    data_vencimento: formatDateBR(invoice.dueDate),
    valor: formatCurrency(invoice.amount).replace('R$', '').trim(),
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

    // pixMessage agora carrega só o boleto (texto + link)
    if (pixMessage) {
      await new Promise((r) => setTimeout(r, 1500))
      const pixRes = await evolutionClient.sendText(client.whatsapp, pixMessage)
      if (pixRes.key?.id) msgIds += `,${pixRes.key.id}`
    }

    // Mensagem dedicada com APENAS o código PIX para facilitar copy no app de pagamento
    if (invoice.pixCode) {
      await new Promise((r) => setTimeout(r, 1500))
      const codeRes = await evolutionClient.sendText(client.whatsapp, invoice.pixCode)
      if (codeRes.key?.id) msgIds += `,${codeRes.key.id}`
    }

    await finalizeLog('sent', msgIds)
    return { status: 'sent', evolutionMsgId: msgIds }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    await finalizeLog('failed', undefined, errorMsg)
    return { status: 'failed', error: errorMsg }
  }
}

/**
 * Dispara UMA mensagem consolidada cobrindo várias faturas do mesmo cliente
 * no mesmo estágio. Cria 1 MessageLog por fatura (mesmo body, mesmo evolutionMsgId)
 * para manter analytics e a constraint @@unique([invoiceId, stage]).
 */
export async function dispatchConsolidatedMessage(
  client: Client,
  invoices: Invoice[],
  stage: Stage,
  testMode: boolean,
  evolutionClient: EvolutionClient | null,
  companySettings?: { companyName?: string | null; companyWhatsapp?: string | null; companyHours?: string | null },
): Promise<DispatchResult> {
  if (invoices.length < 2) throw new Error('dispatchConsolidatedMessage requer ao menos 2 faturas')

  // 1. Anti-duplicata: cria pending log para cada fatura. Se qualquer P2002, considera duplicado.
  const pendingLogIds: string[] = []
  try {
    for (const inv of invoices) {
      const log = await prisma.messageLog.create({
        data: {
          companyId: client.companyId,
          clientId: client.id,
          invoiceId: inv.id,
          stage,
          whatsappTo: client.whatsapp || '',
          messageBody: '',
          status: 'pending',
          testMode,
        },
      })
      pendingLogIds.push(log.id)
    }
  } catch (err: unknown) {
    const error = err as { code?: string }
    // Se algum log já existia, faz rollback dos pendings criados e retorna duplicate
    if (pendingLogIds.length > 0) {
      await prisma.messageLog.deleteMany({ where: { id: { in: pendingLogIds } } })
    }
    if (error?.code === 'P2002') return { status: 'blocked_duplicate' }
    throw err
  }

  // 2. Sem WhatsApp
  if (!client.whatsapp) {
    await prisma.messageLog.updateMany({
      where: { id: { in: pendingLogIds } },
      data: { status: 'skipped_no_phone' },
    })
    return { status: 'skipped_no_phone' }
  }

  // 3. Renderiza template consolidado
  const items: InvoiceItem[] = invoices.map((inv) => ({
    planName: inv.planName || client.planName || 'Plano',
    data_vencimento: formatDateBR(inv.dueDate),
    valor: formatCurrency(inv.amount).replace('R$', '').trim(),
    link_boleto: inv.boletoUrl || undefined,
    codigo_pix: inv.pixCode || undefined,
  }))
  const total = invoices.reduce((s, i) => s + i.amount, 0)
  const messageBody = renderConsolidatedTemplate(stage, {
    nome: client.name.split(' ')[0],
    total_faturas: invoices.length,
    valor_total: formatCurrency(total).replace('R$', '').trim(),
    faturas: items,
    company_name: companySettings?.companyName || process.env.NEXT_PUBLIC_COMPANY_NAME || 'sua operadora',
    company_whatsapp: companySettings?.companyWhatsapp || process.env.NEXT_PUBLIC_COMPANY_WHATSAPP || '',
  })

  if (!messageBody) {
    await prisma.messageLog.updateMany({
      where: { id: { in: pendingLogIds } },
      data: { status: 'failed', errorMessage: 'Template consolidado não definido para o estágio' },
    })
    return { status: 'failed', error: 'Template consolidado não definido' }
  }

  const finalBody: string = messageBody
  async function finalizeAll(status: MessageStatus, msgId?: string, errorMessage?: string) {
    await prisma.messageLog.updateMany({
      where: { id: { in: pendingLogIds } },
      data: {
        messageBody: finalBody,
        status,
        evolutionMsgId: msgId || null,
        errorMessage: errorMessage || null,
        sentAt: new Date(),
      },
    })
  }

  // 4. Modo teste
  if (testMode) {
    await finalizeAll('blocked_test')
    return { status: 'blocked_test' }
  }

  // 5. Evolution não configurado
  if (!evolutionClient) {
    await finalizeAll('failed', undefined, 'Evolution API não configurada')
    return { status: 'failed', error: 'Evolution API não configurada' }
  }

  // 6. Envia consolidada + para cada fatura: rótulo + código PIX (sozinho) para permitir copy limpo
  try {
    const res = await evolutionClient.sendText(client.whatsapp, messageBody)
    let allMsgIds = res.key?.id || ''

    for (const inv of invoices) {
      if (!inv.pixCode) continue

      await new Promise((r) => setTimeout(r, 1500))
      const labelRes = await evolutionClient.sendText(
        client.whatsapp,
        `💳 PIX — *${inv.planName || 'Plano'}*`,
      )
      if (labelRes.key?.id) allMsgIds += `,${labelRes.key.id}`

      await new Promise((r) => setTimeout(r, 1000))
      const codeRes = await evolutionClient.sendText(client.whatsapp, inv.pixCode)
      if (codeRes.key?.id) allMsgIds += `,${codeRes.key.id}`
    }

    await finalizeAll('sent', allMsgIds)
    return { status: 'sent', evolutionMsgId: allMsgIds }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    await finalizeAll('failed', undefined, errorMsg)
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
