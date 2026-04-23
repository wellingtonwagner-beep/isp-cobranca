'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Users, FileText, AlertTriangle, MessageSquare, RefreshCw, TrendingUp,
  ShieldCheck, DollarSign,
} from 'lucide-react'
import Link from 'next/link'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Area,
} from 'recharts'

interface DashboardData {
  totalClients: number
  activeClients: number
  openInvoices: number
  overdueInvoices: number
  todayLogs: number
  monthLogs: number
}

interface AnalyticsData {
  overdueByMonth: { month: string; count: number; amount: number }[]
  messagesByMonth: { month: string; enviadas: number; falhas: number }[]
  recoveryByMonth: { month: string; count: number; amount: number }[]
  stageSuccess: { stage: string; total: number; paid: number; rate: number }[]
  clientDistribution: { name: string; value: number }[]
  summary: {
    totalRecovered: number
    totalRecoveredFormatted: string
    totalOpen: number
    totalOpenFormatted: string
  }
}

const PIE_COLORS = ['#8b5cf6', '#f59e0b', '#ef4444', '#6b7280', '#3b82f6']

function formatCurrencyShort(v: number): string {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return `R$${v.toFixed(0)}`
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    totalClients: 0, activeClients: 0, openInvoices: 0,
    overdueInvoices: 0, todayLogs: 0, monthLogs: 0,
  })
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncCountdown, setSyncCountdown] = useState(0)

  const load = useCallback(async () => {
    const [dashRes, analyticsRes] = await Promise.all([
      fetch('/api/dashboard').catch(() => null),
      fetch('/api/analytics').catch(() => null),
    ])
    if (dashRes?.ok) setData(await dashRes.json())
    if (analyticsRes?.ok) setAnalytics(await analyticsRes.json())
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
    if (res.ok) {
      setSyncCountdown(120)
      setTimeout(async () => {
        await load()
        setSyncMsg(null)
        setSyncCountdown(0)
      }, 120_000)
    }
  }

  // Contador regressivo do auto-refresh do sync
  useEffect(() => {
    if (syncCountdown <= 0) return
    const t = setInterval(() => setSyncCountdown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [syncCountdown])

  const recoveryRate = analytics && (analytics.summary.totalRecovered + analytics.summary.totalOpen > 0)
    ? ((analytics.summary.totalRecovered / (analytics.summary.totalRecovered + analytics.summary.totalOpen)) * 100).toFixed(1)
    : '0'

  const comparisonData = analytics?.overdueByMonth.map((m, i) => ({
    month: m.month,
    inadimplente: m.amount,
    recuperado: analytics.recoveryByMonth[i]?.amount || 0,
  })) || []

  const metrics = [
    {
      label: 'Clientes Ativos',
      value: data.activeClients,
      sub: `${data.totalClients} total`,
      icon: Users,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/30',
      href: '/clientes',
    },
    {
      label: 'Faturas Abertas',
      value: data.openInvoices,
      sub: 'aguardando pagamento',
      icon: FileText,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      href: '/cobrancas',
    },
    {
      label: 'Inadimplentes',
      value: data.overdueInvoices,
      sub: 'faturas vencidas',
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/30',
      href: '/inadimplencia',
    },
    {
      label: 'Envios Hoje',
      value: data.todayLogs,
      sub: `${data.monthLogs} neste mês`,
      icon: MessageSquare,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/30',
      href: '/cobrancas',
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Visão geral do sistema de cobrança</p>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => (
          <Link key={m.label} href={m.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 py-5">
                <div className={`${m.bg} p-3 rounded-xl`}>
                  <m.icon className={`${m.color} w-5 h-5`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{m.value}</p>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{m.label}</p>
                  <p className="text-xs text-gray-400">{m.sub}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Cards de recuperação */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-50 dark:bg-green-900/30 p-2.5 rounded-xl">
                  <ShieldCheck className="text-green-600 dark:text-green-400 w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{analytics.summary.totalRecoveredFormatted}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Recuperado via cobrança</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 dark:bg-amber-900/30 p-2.5 rounded-xl">
                  <DollarSign className="text-amber-600 dark:text-amber-400 w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{analytics.summary.totalOpenFormatted}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ainda em aberto</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-50 dark:bg-purple-900/30 p-2.5 rounded-xl">
                  <TrendingUp className="text-purple-600 dark:text-purple-400 w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{recoveryRate}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Taxa de recuperação</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráficos */}
      {analytics && (
        <>
          {/* Inadimplência vs Recuperação */}
          <Card className="mb-6">
            <CardContent className="py-5">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Inadimplência vs Recuperação (R$) — Últimos 6 Meses</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={formatCurrencyShort} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                    formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                  <Legend />
                  <Bar dataKey="inadimplente" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Inadimplente" />
                  <Area type="monotone" dataKey="recuperado" fill="#22c55e20" stroke="#22c55e" strokeWidth={2} name="Recuperado" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Mensagens Enviadas vs Falhas */}
            <Card>
              <CardContent className="py-5">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Mensagens Enviadas vs Falhas</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.messagesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }} />
                    <Legend />
                    <Bar dataKey="enviadas" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Enviadas" />
                    <Bar dataKey="falhas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Falhas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Taxa de Recuperação por Estágio */}
            <Card>
              <CardContent className="py-5">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Recuperação por Estágio</h3>
                {analytics.stageSuccess.length === 0 ? (
                  <p className="text-gray-400 text-sm py-8 text-center">Dados insuficientes.</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.stageSuccess.map((s) => (
                      <div key={s.stage}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s.stage}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {s.paid}/{s.total} ({s.rate}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${s.rate >= 50 ? 'bg-green-500' : s.rate >= 20 ? 'bg-amber-500' : 'bg-purple-500'}`}
                            style={{ width: `${s.rate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Evolução da Inadimplência */}
            <Card>
              <CardContent className="py-5">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Evolução da Inadimplência</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={analytics.overdueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                      formatter={(value) => [value, 'Faturas Vencidas']}
                    />
                    <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Faturas Vencidas" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribuição de Clientes */}
            <Card>
              <CardContent className="py-5">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Distribuição de Clientes</h3>
                {analytics.clientDistribution.length === 0 ? (
                  <p className="text-gray-400 text-sm py-8 text-center">Sem dados.</p>
                ) : (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie
                          data={analytics.clientDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {analytics.clientDistribution.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {analytics.clientDistribution.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{d.name}</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Atalhos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3 mb-3">
              <RefreshCw className="text-purple-600 dark:text-purple-400 w-4 h-4" />
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Sincronização</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Sincronize clientes e faturas do ERP manualmente.</p>
            {syncMsg && (
              <p className="text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 rounded px-2 py-1 mb-3 flex items-center justify-between gap-2">
                <span>{syncMsg}</span>
                {syncCountdown > 0 && (
                  <span className="opacity-80 whitespace-nowrap font-medium">
                    {Math.floor(syncCountdown / 60)}:{String(syncCountdown % 60).padStart(2, '0')}
                  </span>
                )}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleSync('clientes')}
                className="text-xs bg-white dark:bg-gray-700 border border-purple-200 dark:border-gray-600 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-gray-600 transition-colors"
              >
                Clientes
              </button>
              <button
                onClick={() => handleSync('faturas')}
                className="text-xs bg-white dark:bg-gray-700 border border-purple-200 dark:border-gray-600 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-gray-600 transition-colors"
              >
                Faturas
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="text-purple-600 dark:text-purple-400 w-4 h-4" />
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Central de Cobranças</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Gerencie os disparos de cobrança via WhatsApp.</p>
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
              <TrendingUp className="text-purple-600 dark:text-purple-400 w-4 h-4" />
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Workflow de Cobrança</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Visualize e configure os 7 estágios de cobrança.</p>
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
