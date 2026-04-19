'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, Users, DollarSign, MessageSquare, Download, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

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

interface GrowthData {
  totalClients: number
  newClientsThisMonth: number
  newClientsLastMonth: number
  totalOpenAmountFormatted: string
  sentThisMonth: number
  sentLastMonth: number
  stageStats: { stage: string; _count: { stage: number } }[]
}

const PIE_COLORS = ['#8b5cf6', '#f59e0b', '#ef4444', '#6b7280', '#3b82f6']

export default function GrowthPage() {
  const [growth, setGrowth] = useState<GrowthData | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/growth').then((r) => r.json()),
      fetch('/api/analytics').then((r) => r.json()),
    ])
      .then(([g, a]) => { setGrowth(g); setAnalytics(a) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-20 text-center text-gray-400">Carregando...</div>
  if (!growth || !analytics) return <div className="py-20 text-center text-gray-400">Erro ao carregar dados.</div>

  const clientGrowth = growth.newClientsLastMonth > 0
    ? ((growth.newClientsThisMonth - growth.newClientsLastMonth) / growth.newClientsLastMonth * 100).toFixed(1)
    : null

  const msgGrowth = growth.sentLastMonth > 0
    ? ((growth.sentThisMonth - growth.sentLastMonth) / growth.sentLastMonth * 100).toFixed(1)
    : null

  const recoveryRate = analytics.summary.totalRecovered + analytics.summary.totalOpen > 0
    ? ((analytics.summary.totalRecovered / (analytics.summary.totalRecovered + analytics.summary.totalOpen)) * 100).toFixed(1)
    : '0'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Growth & Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Métricas de crescimento, recuperação e desempenho</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => window.open('/api/export?type=cobrancas', '_blank')}>
          <Download size={14} /> Exportar Cobranças
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Clientes Ativos"
          value={growth.totalClients}
          sub={`+${growth.newClientsThisMonth} este mês`}
          growth={clientGrowth}
          icon={Users}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-50 dark:bg-purple-900/30"
        />
        <MetricCard
          title="Em Aberto"
          value={analytics.summary.totalOpenFormatted}
          sub="faturas abertas + vencidas"
          icon={DollarSign}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-50 dark:bg-amber-900/30"
        />
        <MetricCard
          title="Recuperado"
          value={analytics.summary.totalRecoveredFormatted}
          sub="via cobrança automática"
          icon={ShieldCheck}
          color="text-green-600 dark:text-green-400"
          bg="bg-green-50 dark:bg-green-900/30"
        />
        <MetricCard
          title="Mensagens/Mês"
          value={growth.sentThisMonth}
          sub="enviadas este mês"
          growth={msgGrowth}
          icon={MessageSquare}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-900/30"
        />
      </div>

      {/* Gráficos - Linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Evolução da Inadimplência */}
        <Card>
          <CardContent className="py-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Evolução da Inadimplência (6 meses)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analytics.overdueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                  formatter={(value) => [value, 'Faturas']}
                />
                <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Faturas Vencidas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Valor da Inadimplência */}
        <Card>
          <CardContent className="py-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Valor Inadimplente (R$) por Mês</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.overdueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                  formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Valor Inadimplente" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos - Linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Mensagens Enviadas vs Falhas */}
        <Card>
          <CardContent className="py-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Mensagens Enviadas vs Falhas</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.messagesByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
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

        {/* Recuperação por Mês */}
        <Card>
          <CardContent className="py-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Faturas Recuperadas por Mês</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analytics.recoveryByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                  formatter={(value, name) => [
                    name === 'amount' ? `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : value,
                    name === 'amount' ? 'Valor' : 'Faturas',
                  ]}
                />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name="Faturas Pagas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos - Linha 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Taxa de Sucesso por Estágio */}
        <Card>
          <CardContent className="py-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Taxa de Recuperação por Estágio</h3>
            {analytics.stageSuccess.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">Dados insuficientes para exibir.</p>
            ) : (
              <div className="space-y-3">
                {analytics.stageSuccess.map((s) => (
                  <div key={s.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s.stage}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {s.paid}/{s.total} ({s.rate}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-purple-500 h-2.5 rounded-full transition-all"
                        style={{ width: `${s.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 mt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Taxa geral de recuperação: <span className="font-semibold text-green-600 dark:text-green-400">{recoveryRate}%</span>
                  </p>
                </div>
              </div>
            )}
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
                <ResponsiveContainer width="50%" height={220}>
                  <PieChart>
                    <Pie
                      data={analytics.clientDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
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
    </div>
  )
}

function MetricCard({
  title, value, sub, growth, icon: Icon, color, bg,
}: {
  title: string; value: string | number; sub: string; growth?: string | null; icon: React.ElementType; color: string; bg: string
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-0.5">{title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
          <div className={`${bg} p-3 rounded-xl`}>
            <Icon className={`${color} w-5 h-5`} />
          </div>
        </div>
        {growth !== undefined && growth !== null && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <span className={`text-xs font-medium ${parseFloat(growth) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              <TrendingUp className="inline w-3 h-3 mr-1" />
              {growth}% vs mês anterior
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
