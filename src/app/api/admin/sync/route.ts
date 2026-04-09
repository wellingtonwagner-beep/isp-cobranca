/**
 * POST /api/admin/sync
 *
 * Endpoint interno para disparar sync de clientes ou faturas a partir da UI.
 * Não exige CRON_SECRET do lado do cliente — o secret é lido do ambiente aqui.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json() as { action: 'clientes' | 'faturas' }

    if (!['clientes', 'faturas'].includes(action)) {
      return NextResponse.json({ error: 'action inválida' }, { status: 400 })
    }

    const port    = process.env.PORT || 3000
    const secret  = process.env.CRON_SECRET || ''
    const endpoint = `/api/sync/${action}`

    const res  = await fetch(`http://localhost:${port}${endpoint}`, {
      method:  'POST',
      headers: { 'x-cron-secret': secret },
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
