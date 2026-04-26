import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyId } from '@/lib/session'

export async function GET() {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [company, settings] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, cnpj: true, email: true, logo: true, plan: true },
      }),
      prisma.companySettings.findUnique({ where: { companyId } }),
    ])

    return NextResponse.json({ company, settings })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const {
      // Empresa
      name, logo,
      // ERP
      erpType, sgpBaseUrl, sgpToken, sgpApp,
      // HubSoft
      hubsoftBaseUrl, hubsoftClientId, hubsoftClientSecret, hubsoftUsername, hubsoftPassword,
      // Evolution
      evolutionBaseUrl, evolutionApiKey, evolutionInstance,
      // Mensagens
      companyWhatsapp, companyHours,
      // Cobranças
      testMode, sendWindowStart, sendWindowEnd, sendDays,
      // PIX (banco proprio)
      pixPsp, pixPspApiKey, pixPspClientId, pixPspClientSecret, pixPspWebhookSecret,
      pixPspBaseUrl, pixPspEnv, pixPspCertBase64, pixPspCertPassword,
      pixKeyType, pixKeyValue, pixBeneficiaryName, pixBeneficiaryCity,
    } = body

    // Atualiza dados da empresa
    if (name !== undefined || logo !== undefined) {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          ...(name !== undefined && { name }),
          ...(logo !== undefined && { logo }),
        },
      })
    }

    // Upsert das configurações
    await prisma.companySettings.upsert({
      where: { companyId },
      update: {
        ...(erpType !== undefined && { erpType }),
        ...(sgpBaseUrl !== undefined && { sgpBaseUrl }),
        ...(sgpToken !== undefined && { sgpToken }),
        ...(sgpApp !== undefined && { sgpApp }),
        ...(hubsoftBaseUrl !== undefined && { hubsoftBaseUrl }),
        ...(hubsoftClientId !== undefined && { hubsoftClientId }),
        ...(hubsoftClientSecret !== undefined && { hubsoftClientSecret }),
        ...(hubsoftUsername !== undefined && { hubsoftUsername }),
        ...(hubsoftPassword !== undefined && { hubsoftPassword }),
        ...(evolutionBaseUrl !== undefined && { evolutionBaseUrl }),
        ...(evolutionApiKey !== undefined && { evolutionApiKey }),
        ...(evolutionInstance !== undefined && { evolutionInstance }),
        ...(companyWhatsapp !== undefined && { companyWhatsapp }),
        ...(companyHours !== undefined && { companyHours }),
        ...(testMode !== undefined && { testMode: Boolean(testMode) }),
        ...(sendWindowStart !== undefined && { sendWindowStart }),
        ...(sendWindowEnd !== undefined && { sendWindowEnd }),
        ...(sendDays !== undefined && { sendDays }),
        ...(pixPsp !== undefined && { pixPsp }),
        ...(pixPspApiKey !== undefined && { pixPspApiKey }),
        ...(pixPspClientId !== undefined && { pixPspClientId }),
        ...(pixPspClientSecret !== undefined && { pixPspClientSecret }),
        ...(pixPspWebhookSecret !== undefined && { pixPspWebhookSecret }),
        ...(pixPspBaseUrl !== undefined && { pixPspBaseUrl }),
        ...(pixPspEnv !== undefined && { pixPspEnv }),
        ...(pixPspCertBase64 !== undefined && { pixPspCertBase64 }),
        ...(pixPspCertPassword !== undefined && { pixPspCertPassword }),
        ...(pixKeyType !== undefined && { pixKeyType }),
        ...(pixKeyValue !== undefined && { pixKeyValue }),
        ...(pixBeneficiaryName !== undefined && { pixBeneficiaryName }),
        ...(pixBeneficiaryCity !== undefined && { pixBeneficiaryCity }),
      },
      create: {
        companyId,
        erpType: erpType || 'sgp',
        sgpBaseUrl, sgpToken, sgpApp,
        hubsoftBaseUrl, hubsoftClientId, hubsoftClientSecret, hubsoftUsername, hubsoftPassword,
        evolutionBaseUrl, evolutionApiKey, evolutionInstance,
        companyWhatsapp, companyHours,
        testMode: testMode ?? true,
        sendWindowStart: sendWindowStart || '08:00',
        sendWindowEnd: sendWindowEnd || '20:00',
        sendDays: sendDays || '1,2,3,4,5,6',
        pixPsp, pixPspApiKey, pixPspClientId, pixPspClientSecret, pixPspWebhookSecret,
        pixPspBaseUrl, pixPspEnv, pixPspCertBase64, pixPspCertPassword,
        pixKeyType, pixKeyValue, pixBeneficiaryName, pixBeneficiaryCity,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
