import { prisma } from './prisma'
import { dispatchMessage, dispatchConsolidatedMessage } from './message-dispatcher'
import { isWithinSendWindow } from './send-window'
import { isTodayHoliday } from './holidays'
import { createSgpClient } from './sgp'
import { createHubsoftClient } from './hubsoft'
import { createEvolutionClient } from './evolution'
import { todayStrBRT, addDaysBRT, dateToBRTString, parseDate } from './utils'
import { STAGES, CustomTemplates } from './templates'
import type { BillingEngineResult, Stage } from '@/types'

export async function runDailyCheck(companyId: string): Promise<BillingEngineResult> {
  // Carrega configurações e nome da empresa
  const [settings, company] = await Promise.all([
    prisma.companySettings.findUnique({ where: { companyId } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
  ])

  const testMode = settings?.testMode ?? true
  const windowStart = settings?.sendWindowStart || '08:00'
  const windowEnd = settings?.sendWindowEnd || '20:00'
  const sendDays = settings?.sendDays || '1,2,3,4,5,6'

  const today = todayStrBRT()

  const result: BillingEngineResult = {
    date: today,
    testMode,
    stages: [],
    totalSent: 0,
    totalSkipped: 0,
    totalErrors: 0,
  }

  if (!testMode) {
    if (!isWithinSendWindow(windowStart, windowEnd, sendDays)) {
      console.log(`[BillingEngine][${companyId}] Fora da janela de envio. Abortando.`)
      return result
    }

    const isHoliday = await isTodayHoliday(companyId)
    if (isHoliday) {
      console.log(`[BillingEngine][${companyId}] Hoje é feriado. Abortando.`)
      return result
    }
  }

  const erpType = settings?.erpType || 'sgp'
  const sgpClient = erpType === 'sgp' ? createSgpClient(settings || {}) : null
  const hubsoftClient = erpType === 'hubsoft' ? createHubsoftClient(settings || {}) : null
  const evolutionClient = createEvolutionClient(settings || {})

  const companySettings = {
    companyName: company?.name,
    companyWhatsapp: settings?.companyWhatsapp,
    companyHours: settings?.companyHours,
  }

  let customTemplates: CustomTemplates | undefined
  if (settings?.templatesJson) {
    try {
      customTemplates = JSON.parse(settings.templatesJson) as CustomTemplates
    } catch {
      console.warn(`[BillingEngine][${companyId}] templatesJson inválido, usando padrão.`)
    }
  }

  // Clientes com faturas em atraso há mais de 60 dias entram em fluxo manual
  // (negativação, jurídico, suspensão) — não disparamos cobrança automatica.
  const cutoffDate = addDaysBRT(parseDate(today), -60)
  const cutoffDateStr = dateToBRTString(cutoffDate)
  const blockedInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { not: 'paga' },
      dueDate: { lt: new Date(`${cutoffDateStr}T00:00:00.000Z`) },
    },
    select: { clientId: true },
    distinct: ['clientId'],
  })
  const blockedClientIds = new Set(blockedInvoices.map((i) => i.clientId))
  if (blockedClientIds.size > 0) {
    console.log(`[BillingEngine][${companyId}] ${blockedClientIds.size} cliente(s) com atraso >60d — disparo bloqueado.`)
  }

  for (const stageConfig of STAGES) {
    const targetDate = addDaysBRT(parseDate(today), -stageConfig.dayOffset)
    const targetDateStr = dateToBRTString(targetDate)

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        dueDate: {
          gte: new Date(`${targetDateStr}T00:00:00.000Z`),
          lt: new Date(`${targetDateStr}T23:59:59.999Z`),
        },
        status: { not: 'paga' },
      },
      include: { client: true },
    })

    const stageResult = {
      stage: stageConfig.stage as Stage,
      processed: invoices.length,
      sent: 0,
      skipped: 0,
      errors: 0,
    }

    // Filtra invoices: pula clientes bloqueados (>60d) e valida pagamento no ERP.
    // Resultado: invoicesToSend agrupadas por cliente para decidir single vs consolidado.
    const invoicesToSend: typeof invoices = []
    for (const invoice of invoices) {
      if (blockedClientIds.has(invoice.clientId)) {
        stageResult.skipped++
        continue
      }
      if (invoice.client.cpfCnpj && (sgpClient || hubsoftClient)) {
        try {
          const paid = sgpClient
            ? await sgpClient.checkInvoicePaid(invoice.client.cpfCnpj, invoice.externalId || invoice.id)
            : await hubsoftClient!.checkInvoicePaid(invoice.client.cpfCnpj, invoice.externalId || invoice.id)
          if (paid) {
            await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'paga' } })
            stageResult.skipped++
            continue
          }
        } catch {
          // Se falhar consulta ao ERP, segue com status local
        }
      }
      invoicesToSend.push(invoice)
    }

    // Agrupa por cliente para consolidar quando houver mais de uma fatura no mesmo estágio
    const byClient = new Map<string, typeof invoices>()
    for (const inv of invoicesToSend) {
      const list = byClient.get(inv.clientId) || []
      list.push(inv)
      byClient.set(inv.clientId, list)
    }

    for (const clientInvoices of Array.from(byClient.values())) {
      const isConsolidated = clientInvoices.length > 1
      const res = isConsolidated
        ? await dispatchConsolidatedMessage(
            clientInvoices[0].client,
            clientInvoices,
            stageConfig.stage as Stage,
            testMode,
            evolutionClient,
            companySettings,
          )
        : await dispatchMessage(
            clientInvoices[0].client,
            clientInvoices[0],
            stageConfig.stage as Stage,
            testMode,
            evolutionClient,
            companySettings,
            customTemplates,
          )

      // Conta uma vez por mensagem despachada (não por fatura).
      if (res.status === 'sent' || res.status === 'blocked_test') {
        stageResult.sent++
      } else if (res.status === 'failed') {
        stageResult.errors++
      } else {
        stageResult.skipped++
      }
    }

    if (stageResult.processed > 0) {
      result.stages.push(stageResult)
    }

    result.totalSent += stageResult.sent
    result.totalSkipped += stageResult.skipped
    result.totalErrors += stageResult.errors
  }

  console.log(`[BillingEngine][${companyId}] ${today} | Enviados: ${result.totalSent} | Pulados: ${result.totalSkipped} | Erros: ${result.totalErrors}`)
  return result
}

/**
 * Executa o billing engine para todas as empresas ativas.
 * Usado pelo cron server.
 */
export async function runDailyCheckAllCompanies(): Promise<Record<string, BillingEngineResult>> {
  const companies = await prisma.company.findMany({
    where: { active: true },
    select: { id: true },
  })

  const results: Record<string, BillingEngineResult> = {}

  for (const company of companies) {
    try {
      results[company.id] = await runDailyCheck(company.id)
    } catch (err) {
      console.error(`[BillingEngine] Erro na empresa ${company.id}:`, err)
    }
  }

  return results
}
