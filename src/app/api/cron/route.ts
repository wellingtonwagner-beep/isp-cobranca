import { NextRequest, NextResponse } from 'next/server'
import { runDailyCheckAllCompanies } from '@/lib/billing-engine'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await runDailyCheckAllCompanies()
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('[/api/cron] Erro:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
