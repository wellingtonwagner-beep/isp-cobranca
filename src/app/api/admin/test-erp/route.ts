import { NextResponse } from 'next/server'
import { getCompanyId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createSgpClient } from '@/lib/sgp'
import { createHubsoftClient } from '@/lib/hubsoft'

export async function GET() {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const settings = await prisma.companySettings.findUnique({ where: { companyId } })
    const erpType = settings?.erpType || 'sgp'

    if (erpType === 'hubsoft') {
      const client = createHubsoftClient(settings || {})
      if (!client) {
        return NextResponse.json({ ok: false, message: 'HubSoft não configurado. Preencha todos os campos.' })
      }

      const { paginacao } = await client.getAllClientes(0, 1)
      return NextResponse.json({
        ok: true,
        message: `Conexão com HubSoft OK! ${paginacao.total_registros} clientes encontrados.`,
        totalClientes: paginacao.total_registros,
      })
    }

    if (erpType === 'sgp') {
      const client = createSgpClient(settings || {})
      if (!client) {
        return NextResponse.json({ ok: false, message: 'SGP não configurado. Preencha todos os campos.' })
      }

      const clientes = await client.getClientesComFaturaAberta()
      return NextResponse.json({
        ok: true,
        message: `Conexão com SGP OK! ${clientes.length} clientes com faturas abertas.`,
        totalClientes: clientes.length,
      })
    }

    return NextResponse.json({ ok: false, message: `Tipo ERP '${erpType}' não suporta teste de conexão.` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/admin/test-erp]', err)
    return NextResponse.json({ ok: false, message: `Falha na conexão: ${msg}` })
  }
}
