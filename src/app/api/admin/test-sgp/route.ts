import { NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const settings = await prisma.companySettings.findUnique({ where: { companyId } })

    const baseUrl = (settings?.sgpBaseUrl || process.env.SGP_BASE_URL || '').replace(/\/$/, '')
    const token = settings?.sgpToken || process.env.SGP_TOKEN || ''
    const app = settings?.sgpApp || process.env.SGP_APP || ''

    if (!baseUrl) {
      return NextResponse.json({ ok: false, error: 'SGP_BASE_URL não configurado' })
    }

    const testUrl = `${baseUrl}/api/ura/clientes/`
    const start = Date.now()

    try {
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app, token, offset: 0, limit: 1 }),
        signal: AbortSignal.timeout(10_000),
      })

      const elapsed = Date.now() - start
      const body = await res.text()

      return NextResponse.json({
        ok: res.ok,
        status: res.status,
        elapsed_ms: elapsed,
        url: testUrl,
        body_preview: body.slice(0, 300),
      })
    } catch (fetchErr) {
      const elapsed = Date.now() - start
      return NextResponse.json({
        ok: false,
        elapsed_ms: elapsed,
        url: testUrl,
        error: String(fetchErr),
      })
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
