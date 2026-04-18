'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users, FileText, AlertTriangle, MessageSquare, RefreshCw, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface DashboardData {
  totalClients: number
  activeClients: number
  openInvoices: number
  overdueInvoices: number
  todayLogs: number
  monthLogs: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    totalClients: 0, activeClients: 0, openInvoices: 0,
    overdueInvoices: 0, todayLogs: 0, monthLogs: 0,
  })
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/dashboard').catch(() => null)
    if (res?.ok) setData(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSync(action: string) {
    setSyncMsg(null)
    const res = await fetch('/api/admin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const d = await res.json().catch(() => ({}))
    setSyncMsg(d.message || d.error || (res.ok ? 'Sync iniciado.' : `Erro ${res.status}`))
    if (res.ok) setTimeout(() => load(), 90_000)
  }

  const metrics = [
    {
      label: 'Clientes Ativos',
      value: data.activeClients,
      sub: `${data.totalClients} total`,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      href: '/clientes',
    },
    {
      label: 'Faturas Abertas',
      value: data.openInvoices,
      sub: 'aguardando pagamento',
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/cobrancas',
    },
    {
      label: 'Inadimplentes',
      value: data.overdueInvoices,
      sub: 'faturas vencidas',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/inadimplencia',
    },
    {
      label: 'Envios Hoje',
      value: data.todayLogs,
      sub: `${data.monthLogs} neste mês`,
      icon: MessageSquare,
      color: 'text-green-600',
      bg: 'bg-green-50',
      href: '/cobrancas',
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral do sistema de cobrança</p>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <Link key={m.label} href={m.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 py-5">
                <div className={`${m.bg} p-3 rounded-xl`}>
                  <m.icon className={`${m.color} w-5 h-5`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{m.value}</p>
                  <p className="text-sm font-medium text-gray-600">{m.label}</p>
                  <p className="text-xs text-gray-400">{m.sub}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3 mb-3">
              <RefreshCw className="text-purple-600 w-4 h-4" />
              <h3 className="font-semibold text-gray-800 text-sm">Sincronização</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">Sincronize clientes e faturas do ERP manualmente.</p>
            {syncMsg && (
              <p className="text-xs text-purple-700 bg-purple-50 rounded px-2 py-1 mb-3">{syncMsg}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleSync('clientes')}
                className="text-xs bg-white border border-purple-200 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
              >
                Clientes
              </button>
              <button
                onClick={() => handleSync('faturas')}
                className="text-xs bg-white border border-purple-200 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
              >
                Faturas
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="text-purple-600 w-4 h-4" />
              <h3 className="font-semibold text-gray-800 text-sm">Central de Cobranças</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Gerencie os disparos de cobrança via WhatsApp.</p>
            <Link
              href="/cobrancas"
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Ver Cobranças
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="text-purple-600 w-4 h-4" />
              <h3 className="font-semibold text-gray-800 text-sm">Workflow de Cobrança</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Visualize e configure os 7 estágios de cobrança.</p>
            <Link
              href="/workflow"
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Ver Workflow
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
