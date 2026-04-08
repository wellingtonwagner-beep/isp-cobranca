import { prisma } from './prisma'
import { dispatchMessage } from './message-dispatcher'
import { isWithinSendWindow } from './send-window'
import { isTodayHoliday } from './holidays'
import { sgp } from './sgp'
import { todayStrBRT, addDaysBRT, dateToBRTString, parseDate } from './utils'
import { STAGES } from './templates'
import type { BillingEngineResult, Stage } from '@/types'

async function getConfig() {
  const configs = await prisma.config.findMany()
  const map: Record<string, string> = {}
  for (const c of configs) map[c.key] = c.value
  return {
    testMode: map['test_mode'] === 'true',
    windowStart: map['send_window_start'] || '08:00',
    windowEnd: map['send_window_end'] || '20:00',
    sendDays: map['send_days'] || '1,2,3,4,5,6',
  }
}

export async function runDailyCheck(): Promise<BillingEngineResult> {
  const config = await getConfig()
  const today = todayStrBRT()

  const result: BillingEngineResult = {
    date: today,
    testMode: config.testMode,
    stages: [],
    totalSent: 0,
    totalSkipped: 0,
    totalErrors: 0,
  }

  // Verifica janela de envio (em prod não-teste)
  if (!config.testMode) {
    if (!isWithinSendWindow(config.windowStart, config.windowEnd, config.sendDays)) {
      console.log(`[BillingEngine] Fora da janela de envio. Abortando.`)
      return result
    }

    const isHoliday = await isTodayHoliday()
    if (isHoliday) {
      console.log(`[BillingEngine] Hoje é feriado. Abortando.`)
      return result
    }
  }

  // Processa cada estágio
  for (const stageConfig of STAGES) {
    const targetDate = addDaysBRT(parseDate(today), -stageConfig.dayOffset)
    const targetDateStr = dateToBRTString(targetDate)

    // Busca faturas com vencimento na data alvo
    const invoices = await prisma.invoice.findMany({
      where: {
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
      // Para D+0, revalida pagamento direto no SGP
      if (stageConfig.stage === 'D_ZERO') {
        try {
          const sgpInvoice = await sgp.getInvoiceById(invoice.id)
          if (sgpInvoice && (sgpInvoice.status === 'paga' || sgpInvoice.status === 'pago')) {
            // Atualiza status local
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: 'paga' },
            })
            stageResult.skipped++
            continue
          }
        } catch {
          // Se falhar a consulta SGP, continua com o status local
        }
      }

      const res = await dispatchMessage(invoice.client, invoice, stageConfig.stage as Stage, config.testMode)

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

  console.log(`[BillingEngine] ${today} | Enviados: ${result.totalSent} | Pulados: ${result.totalSkipped} | Erros: ${result.totalErrors}`)
  return result
}
