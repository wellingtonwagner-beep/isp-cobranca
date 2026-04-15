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

    const headers = { apikey: key, 'Content-Type': 'application/json' }

    // 1. Verifica se a instância existe
    let instanceExists = false
    try {
      const checkRes = await fetch(`${base}/instance/connectionState/${inst}`, {
        headers,
        cache: 'no-store',
      })
      if (checkRes.ok) {
        const checkData = await checkRes.json()
        // Se já está conectada, não precisa de QR
        if (checkData?.instance?.state === 'open') {
          return NextResponse.json({ error: 'WhatsApp já está conectado! Não é necessário escanear QR Code.' })
        }
        instanceExists = true
      }
    } catch {
      // instância não existe
    }

    // 2. Se a instância não existe, cria ela
    if (!instanceExists) {
      try {
        const createRes = await fetch(`${base}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instanceName: inst,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
          }),
        })
        const createData = await createRes.json()
        console.log(`[QR] Instância criada:`, JSON.stringify(createData).slice(0, 200))

        // Algumas versões da Evolution retornam o QR na criação
        if (createData?.qrcode?.base64) {
          return NextResponse.json({ base64: createData.qrcode.base64 })
        }

        // Aguarda um momento para a instância inicializar
        await new Promise((r) => setTimeout(r, 2000))
      } catch (err) {
        console.error('[QR] Erro ao criar instância:', err)
      }
    }

    // 3. Tenta conectar e obter QR Code
    const res = await fetch(`${base}/instance/connect/${inst}`, {
      headers,
      cache: 'no-store',
    })

    const data = await res.json()
    console.log(`[QR] Connect response:`, JSON.stringify(data).slice(0, 300))

    // Evolution API pode retornar o base64 em diferentes formatos
    const qrBase64 = data?.base64 || data?.qrcode?.base64

    if (!qrBase64) {
      return NextResponse.json({
        error: 'QR Code não disponível. Tente novamente em alguns segundos.',
        debug: { status: res.status, keys: Object.keys(data) },
      })
    }

    return NextResponse.json({ base64: qrBase64 })
  } catch (err) {
    console.error('[QR] Erro:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
