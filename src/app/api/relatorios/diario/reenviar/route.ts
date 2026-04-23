/**
 * POST /api/relatorios/diario/reenviar
 * Reenvia mensagens nao entregues do dia (failed, blocked_duplicate, blocked_window, blocked_holiday).
 * Pula skipped_no_phone (cliente nao tem WhatsApp).
 *
 * Body: { date: 'YYYY-MM-DD', logIds?: string[] }
 *   - Se logIds for fornecido, reenvia apenas esses logs.
 *   - Caso contrario, reenvia todos os logs nao entregues do dia.
 *
 * Estrategia:
 *   1. Carrega logs alvo (com client + invoice)
 *   2. Agrupa por (clientId, stage)
 *   3. Deleta logs antigos do grupo
 *   4. Se 1 fatura: dispatchMessage; se 2+: dispatchConsolidatedMessage
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { dispatchMessage, dispatchConsolidatedMessage } from '@/lib/message-dispatcher'
import { createEvolutionClient } from '@/lib/evolution'
import { CustomTemplates } from '@/lib/templates'
import type { Stage } from '@/types'

const RETRYABLE = ['failed', 'blocked_duplicate', 'blocked_window', 'blocked_holiday']

export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { date?: string; logIds?: string[] }
    const date = body.date || new Date().toISOString().slice(0, 10)
    const logIds = body.logIds

    const dayStart = new Date(`${date}T00:00:00.000Z`)
    const dayEnd = new Date(`${date}T23:59:59.999Z`)

    const where: Record<string, unknown> = {
      companyId,
      sentAt: { gte: dayStart, lte: dayEnd },
      status: { in: RETRYABLE },
    }
    if (logIds && logIds.length > 0) {
      where.id = { in: logIds }
    }

    const logs = await prisma.messageLog.findMany({
      where,
      include: { client: true, invoice: true },
    })

    if (logs.length === 0) {
      return NextResponse.json({ ok: true, total: 0, sent: 0, failed: 0, skipped: 0, message: 'Nenhuma mensagem para reenviar.' })
    }

    // Carrega settings + Evolution + templates customizados uma unica vez
    const [settings, company] = await Promise.all([
      prisma.companySettings.findUnique({ where: { companyId } }),
      prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    ])
    const evolutionClient = createEvolutionClient(settings || {})
    const testMode = settings?.testMode ?? true
    const companySettings = {
      companyName: company?.name,
      companyWhatsapp: settings?.companyWhatsapp,
      companyHours: settings?.companyHours,
    }
    let customTemplates: CustomTemplates | undefined
    if (settings?.templatesJson) {
      try { customTemplates = JSON.parse(settings.templatesJson) as CustomTemplates } catch {}
    }

    // Agrupa por (clientId + stage)
    const groups = new Map<string, typeof logs>()
    for (const log of logs) {
      const key = `${log.clientId}::${log.stage}`
      const list = groups.get(key) || []
      list.push(log)
      groups.set(key, list)
    }

    let sent = 0, failed = 0, skipped = 0

    for (const groupLogs of Array.from(groups.values())) {
      const stage = groupLogs[0].stage as Stage
      const client = groupLogs[0].client
      const invoiceIds = groupLogs.map((l) => l.invoiceId)
      const invoices = groupLogs.map((l) => l.invoice)

      // Apaga logs antigos para liberar a constraint @@unique([invoiceId, stage])
      await prisma.messageLog.deleteMany({
        where: { invoiceId: { in: invoiceIds }, stage },
      })

      const isConsolidated = invoices.length > 1
      const res = isConsolidated
        ? await dispatchConsolidatedMessage(client, invoices, stage, testMode, evolutionClient, companySettings)
        : await dispatchMessage(client, invoices[0], stage, testMode, evolutionClient, companySettings, customTemplates)

      if (res.status === 'sent' || res.status === 'blocked_test') sent++
      else if (res.status === 'failed') failed++
      else skipped++
    }

    return NextResponse.json({
      ok: true,
      total: logs.length,
      groups: groups.size,
      sent, failed, skipped,
      message: `Reenviadas ${sent} mensagens (${groups.size} ${groups.size === 1 ? 'grupo' : 'grupos'}). Falhas: ${failed}. Puladas: ${skipped}.`,
    })
  } catch (err) {
    console.error('[POST /api/relatorios/diario/reenviar]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
