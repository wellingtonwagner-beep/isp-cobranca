/**
 * GET /api/admin/diagnostico
 * Retorna raio-X do estado de cobrança da empresa autenticada:
 * - logs dos últimos 7 dias agrupados por dia + status
 * - configurações relevantes (testMode, janela, dias, ERP, evolution)
 * - última mensagem 'sent' registrada
 * - faturas elegíveis para cada estágio hoje (o que "deveria" ser enviado)
 */
import { NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { todayStrBRT, addDaysBRT, dateToBRTString, parseDate } from '@/lib/utils'
import { STAGES } from '@/lib/templates'
import { isWithinSendWindow } from '@/lib/send-window'

export async function GET() {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const settings = await prisma.companySettings.findUnique({ where: { companyId } })
    const today = todayStrBRT()
    const todayStart = new Date(`${today}T00:00:00.000Z`)

    // 1. Logs dos últimos 7 dias por dia + status
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    const logs = await prisma.messageLog.findMany({
      where: { companyId, sentAt: { gte: sevenDaysAgo } },
      select: { sentAt: true, status: true },
    })

    const logsByDay: Record<string, Record<string, number>> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      logsByDay[key] = {}
    }
    for (const log of logs) {
      const key = new Date(log.sentAt).toISOString().slice(0, 10)
      if (!logsByDay[key]) logsByDay[key] = {}
      logsByDay[key][log.status] = (logsByDay[key][log.status] || 0) + 1
    }

    // 2. Última mensagem 'sent' registrada
    const lastSent = await prisma.messageLog.findFirst({
      where: { companyId, status: 'sent' },
      orderBy: { sentAt: 'desc' },
      select: {
        sentAt: true,
        stage: true,
        whatsappTo: true,
        client: { select: { name: true } },
      },
    })

    // 3. Faturas elegíveis para cada estágio HOJE (o que o billing engine processaria)
    const eligibleByStage: { stage: string; label: string; targetDate: string; eligible: number; alreadySent: number }[] = []
    for (const stageConfig of STAGES) {
      const targetDate = addDaysBRT(parseDate(today), -stageConfig.dayOffset)
      const targetDateStr = dateToBRTString(targetDate)
      const dueDateRange = {
        gte: new Date(`${targetDateStr}T00:00:00.000Z`),
        lt: new Date(`${targetDateStr}T23:59:59.999Z`),
      }

      const eligible = await prisma.invoice.count({
        where: {
          companyId,
          dueDate: dueDateRange,
          status: { not: 'paga' },
        },
      })

      const alreadySent = await prisma.invoice.count({
        where: {
          companyId,
          dueDate: dueDateRange,
          messageLogs: { some: { stage: stageConfig.stage } },
        },
      })

      if (eligible > 0 || alreadySent > 0) {
        eligibleByStage.push({
          stage: stageConfig.stage,
          label: stageConfig.shortLabel,
          targetDate: targetDateStr,
          eligible,
          alreadySent,
        })
      }
    }

    // 4. Status das configurações relevantes
    const windowStart = settings?.sendWindowStart || '08:00'
    const windowEnd = settings?.sendWindowEnd || '20:00'
    const sendDays = settings?.sendDays || '1,2,3,4,5,6'

    const config = {
      testMode: settings?.testMode ?? true,
      sendWindowStart: windowStart,
      sendWindowEnd: windowEnd,
      sendDays,
      withinSendWindow: isWithinSendWindow(windowStart, windowEnd, sendDays),
      erpType: settings?.erpType || 'sgp',
      erpConfigured: !!(
        (settings?.sgpBaseUrl && settings?.sgpToken && settings?.sgpApp) ||
        (settings?.hubsoftBaseUrl && settings?.hubsoftClientId)
      ),
      evolutionConfigured: !!(settings?.evolutionBaseUrl && settings?.evolutionApiKey && settings?.evolutionInstance),
    }

    // 5. Hora atual no servidor (BRT)
    const nowBrt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

    return NextResponse.json({
      today,
      nowBrt,
      logsByDay,
      lastSent,
      eligibleByStage,
      config,
    })
  } catch (err) {
    console.error('[GET /api/admin/diagnostico]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
