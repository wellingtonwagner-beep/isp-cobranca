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

    // 1. Verifica estado atual da instância
    let state = 'unknown'
    try {
      const checkRes = await fetch(`${base}/instance/connectionState/${inst}`, {
        headers,
        cache: 'no-store',
      })
      if (checkRes.ok) {
        const checkData = await checkRes.json()
        state = checkData?.instance?.state || 'unknown'
        console.log(`[QR] Estado atual: ${state}`)

        if (state === 'open') {
          return NextResponse.json({ error: 'WhatsApp já está conectado! Não é necessário escanear QR Code.' })
        }
      }
    } catch {
      state = 'not_found'
    }

    // 2. Se instância não existe, cria
    if (state === 'not_found' || state === 'unknown') {
      try {
        console.log(`[QR] Criando instância ${inst}...`)
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
        console.log(`[QR] Create response:`, JSON.stringify(createData).slice(0, 300))

        // Algumas versões retornam QR na criação
        const qr = createData?.qrcode?.base64 || createData?.base64
        if (qr) return NextResponse.json({ base64: qr })

        await new Promise((r) => setTimeout(r, 2000))
      } catch (err) {
        console.error('[QR] Erro ao criar instância:', err)
      }
    }

    // 3. Se está travada em "connecting" ou "close", reinicia antes
    if (state === 'connecting' || state === 'close') {
      try {
        console.log(`[QR] Reiniciando instância (estado: ${state})...`)
        await fetch(`${base}/instance/restart/${inst}`, {
          method: 'PUT',
          headers,
          cache: 'no-store',
        })
        await new Promise((r) => setTimeout(r, 3000))
      } catch (err) {
        console.error('[QR] Erro ao reiniciar:', err)
        // Se restart falhar, tenta logout + connect
        try {
          await fetch(`${base}/instance/logout/${inst}`, {
            method: 'DELETE',
            headers,
            cache: 'no-store',
          })
          await new Promise((r) => setTimeout(r, 2000))
        } catch {
          // ignora
        }
      }
    }

    // 4. Tenta conectar e obter QR Code
    console.log(`[QR] Chamando /instance/connect/${inst}...`)
    const res = await fetch(`${base}/instance/connect/${inst}`, {
      headers,
      cache: 'no-store',
    })

    const data = await res.json()
    console.log(`[QR] Connect response:`, JSON.stringify(data).slice(0, 300))

    const qrBase64 = data?.base64 || data?.qrcode?.base64

    if (qrBase64) {
      return NextResponse.json({ base64: qrBase64 })
    }

    // 5. Se não veio QR, tenta buscar via fetchInstances (fallback)
    try {
      console.log(`[QR] Tentando fetchInstances como fallback...`)
      const fetchRes = await fetch(`${base}/instance/fetchInstances?instanceName=${inst}`, {
        headers,
        cache: 'no-store',
      })
      const fetchData = await fetchRes.json()
      console.log(`[QR] FetchInstances response:`, JSON.stringify(fetchData).slice(0, 300))
    } catch {
      // apenas log
    }

    return NextResponse.json({
      error: `QR Code não disponível (estado: ${state}). Tente novamente em alguns segundos.`,
    })
  } catch (err) {
    console.error('[QR] Erro geral:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
