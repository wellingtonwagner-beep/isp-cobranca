/**
 * POST /api/admin/cron
 *
 * Endpoint interno para disparar o billing engine a partir da UI.
 * Não exige CRON_SECRET do lado do cliente — o secret é lido do ambiente aqui.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest) {
  try {
    const port   = process.env.PORT || 3000
    const secret = process.env.CRON_SECRET || ''

    const res  = await fetch(`http://localhost:${port}/api/cron`, {
      method:  'POST',
      headers: { 'x-cron-secret': secret },
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
