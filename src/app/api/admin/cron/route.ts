/**
 * POST /api/admin/cron
 * Dispara o billing engine para a empresa autenticada.
 */
import { NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { runDailyCheck } from '@/lib/billing-engine'

const activeRuns = new Map<string, number>()
const LOCK_TTL_MS = 10 * 60 * 1000 // 10 minutos

export async function POST() {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = Date.now()
  const startedAt = activeRuns.get(companyId)
  if (startedAt && now - startedAt < LOCK_TTL_MS) {
    const secondsAgo = Math.floor((now - startedAt) / 1000)
    return NextResponse.json({
      error: `Já existe um disparo em execução (iniciado há ${secondsAgo}s). Aguarde a conclusão antes de disparar novamente.`,
    }, { status: 429 })
  }

  activeRuns.set(companyId, now)
  try {
    const result = await runDailyCheck(companyId)
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    activeRuns.delete(companyId)
  }
}
