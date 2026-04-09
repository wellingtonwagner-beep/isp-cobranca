/**
 * POST /api/admin/cron
 * Dispara o billing engine para a empresa autenticada.
 */
import { NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { runDailyCheck } from '@/lib/billing-engine'

export async function POST() {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await runDailyCheck(companyId)
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
