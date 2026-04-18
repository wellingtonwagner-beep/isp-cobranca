import { NextRequest, NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { TEMPLATES } from '@/lib/templates'
import type { Stage } from '@/types'

// GET — retorna templates customizados mesclados com os padrões
export async function GET() {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [settings, company] = await Promise.all([
      prisma.companySettings.findUnique({
        where: { companyId },
        select: { templatesJson: true, companyWhatsapp: true },
      }),
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      }),
    ])

    let custom: Record<string, { mainMessage: string; pixMessage?: string }> = {}
    if (settings?.templatesJson) {
      try { custom = JSON.parse(settings.templatesJson) } catch { /* ignore */ }
    }

    // Mescla: custom sobrescreve padrão
    const templates = TEMPLATES.map((t) => {
      const stage = t.stage as Stage
      const defaultVars = {
        nome: '{nome}',
        data_vencimento: '{data_vencimento}',
        valor: '{valor}',
        link_boleto: '{link_boleto}',
        codigo_pix: '{codigo_pix}',
        company_name: company?.name || 'sua operadora',
        company_whatsapp: settings?.companyWhatsapp || '{whatsapp}',
      }
      return {
        stage,
        mainMessage: custom[stage]?.mainMessage ?? t.mainMessage(defaultVars),
        pixMessage: custom[stage]?.pixMessage ?? (t.pixMessage ? t.pixMessage(defaultVars) : undefined),
        isCustom: !!custom[stage],
      }
    })

    return NextResponse.json({ templates })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PUT — salva templates customizados
export async function PUT(req: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { templates } = await req.json() as {
      templates: Record<string, { mainMessage: string; pixMessage?: string }>
    }

    await prisma.companySettings.update({
      where: { companyId },
      data: { templatesJson: JSON.stringify(templates) },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
