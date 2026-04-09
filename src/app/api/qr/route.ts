import { NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const settings = await prisma.companySettings.findUnique({ where: { companyId } })

    const base = settings?.evolutionBaseUrl || process.env.EVOLUTION_BASE_URL
    const key = settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY
    const inst = settings?.evolutionInstance || process.env.EVOLUTION_INSTANCE

    if (!base || !key || !inst) {
      return NextResponse.json({ error: 'Evolution API não configurada.' }, { status: 400 })
    }

    const res = await fetch(`${base}/instance/connect/${inst}`, {
      headers: { apikey: key },
      cache: 'no-store',
    })

    const data = await res.json() as { base64?: string; code?: string }

    if (!data.base64) {
      return NextResponse.json({ error: 'QR Code não disponível. Instância já conectada ou expirada.' })
    }

    return NextResponse.json({ base64: data.base64 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
