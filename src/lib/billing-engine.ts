import { prisma } from './prisma'
import { dispatchMessage } from './message-dispatcher'
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

    for (const invoice of invoices) {
      // D+0: valida pagamento em tempo real no ERP
      if (stageConfig.stage === 'D_ZERO' && invoice.client.cpfCnpj) {
        let paid = false
        try {
          if (sgpClient) {
            paid = await sgpClient.checkInvoicePaid(invoice.client.cpfCnpj, invoice.externalId || invoice.id)
          } else if (hubsoftClient) {
            paid = await hubsoftClient.checkInvoicePaid(invoice.client.cpfCnpj, invoice.externalId || invoice.id)
          }
          if (paid) {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: 'paga' },
            })
            stageResult.skipped++
            continue
          }
        } catch {
          // Se falhar a consulta ao ERP, continua com o status local
        }
      }

      const res = await dispatchMessage(
        invoice.client,
        invoice,
        stageConfig.stage as Stage,
        testMode,
        evolutionClient,
        companySettings,
        customTemplates,
      )

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
