import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const base = process.env.EVOLUTION_BASE_URL
    const key  = process.env.EVOLUTION_API_KEY
    const inst = process.env.EVOLUTION_INSTANCE

    const res = await fetch(`${base}/instance/connect/${inst}`, {
      headers: { apikey: key! },
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
