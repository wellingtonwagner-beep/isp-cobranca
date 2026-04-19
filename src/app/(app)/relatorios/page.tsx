'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, DollarSign, TrendingUp, ShieldCheck, AlertTriangle } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Area,
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

function formatCurrencyShort(v: number): string {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return `R$${v.toFixed(0)}`
}

export default function RelatoriosPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-20 text-center text-gray-400">Carregando...</div>
  if (!data) return <div className="py-20 text-center text-gray-400">Erro ao carregar dados.</div>

  const totalSent = data.messagesByMonth.reduce((s, m) => s + m.enviadas, 0)
  const totalFailed = data.messagesByMonth.reduce((s, m) => s + m.falhas, 0)
  const deliveryRate = totalSent + totalFailed > 0
    ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1)
    : '0'

  const recoveryRate = data.summary.totalRecovered + data.summary.totalOpen > 0
    ? ((data.summary.totalRecovered / (data.summary.totalRecovered + data.summary.totalOpen)) * 100).toFixed(1)
    : '0'

  const comparisonData = data.overdueByMonth.map((m, i) => ({
    month: m.month,
    inadimplente: m.amount,
    recuperado: data.recoveryByMonth[i]?.amount || 0,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Relatórios</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Análise de recuperação de crédito e ROI do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.open('/api/export?type=inadimplencia', '_blank')}>
            <Download size={14} /> Inadimplentes
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open('/api/export?type=cobrancas', '_blank')}>
            <Download size={14} /> Cobranças
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.summary.totalRecoveredFormatted}</p>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-0.5">Total Recuperado</p>
                <p className="text-xs text-gray-400">via cobrança automática</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-xl">
                <ShieldCheck className="text-green-600 dark:text-green-400 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.summary.totalOpenFormatted}</p>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-0.5">Ainda em Aberto</p>
                <p className="text-xs text-gray-400">faturas abertas + vencidas</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-xl">
                <AlertTriangle className="text-amber-600 dark:text-amber-400 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{recoveryRate}%</p>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-0.5">Taxa de Recuperação</p>
                <p className="text-xs text-gray-400">recuperado / total cobrado</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-xl">
                <TrendingUp className="text-purple-600 dark:text-purple-400 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{deliveryRate}%</p>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-0.5">Taxa de Entrega</p>
                <p className="text-xs text-gray-400">{totalSent} enviadas / {totalSent + totalFailed} total</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl">
                <DollarSign className="text-blue-600 dark:text-blue-400 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico principal: Inadimplente vs Recuperado */}
      <Card className="mb-6">
        <CardContent className="py-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Inadimplência vs Recuperação (R$) - Últimos 6 Meses</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={formatCurrencyShort} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                formatter={(value, name) => [
                  `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  name === 'inadimplente' ? 'Inadimplente' : 'Recuperado',
                ]}
              />
              <Legend />
              <Bar dataKey="inadimplente" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Inadimplente" />
              <Area type="monotone" dataKey="recuperado" fill="#22c55e20" stroke="#22c55e" strokeWidth={2} name="Recuperado" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Faturas recuperadas por mês */}
        <Card>
          <CardContent className="py-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Faturas Recuperadas por Mês</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.recoveryByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Faturas Pagas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Eficiência por estágio */}
        <Card>
          <CardContent className="py-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Eficiência por Estágio de Cobrança</h3>
            {data.stageSuccess.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">Dados insuficientes para exibir.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.stageSuccess} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" unit="%" />
                  <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} stroke="#9ca3af" width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                    formatter={(value) => [`${value}%`, 'Taxa de Recuperação']}
                  />
                  <Bar dataKey="rate" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Taxa %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mensagens enviadas */}
      <Card className="mb-6">
        <CardContent className="py-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Volume de Mensagens por Mês</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.messagesByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }} />
              <Legend />
              <Line type="monotone" dataKey="enviadas" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="Enviadas" />
              <Line type="monotone" dataKey="falhas" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Falhas" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela de detalhamento por estágio */}
      {data.stageSuccess.length > 0 && (
        <Card>
          <CardContent className="py-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Detalhamento por Estágio</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-4 py-2 text-left">Estágio</th>
                    <th className="px-4 py-2 text-right">Cobranças Enviadas</th>
                    <th className="px-4 py-2 text-right">Faturas Pagas</th>
                    <th className="px-4 py-2 text-right">Taxa de Sucesso</th>
                    <th className="px-4 py-2 text-left">Desempenho</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stageSuccess.map((s) => (
                    <tr key={s.stage} className="border-b border-gray-50 dark:border-gray-700/50">
                      <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{s.stage}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">{s.total}</td>
                      <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400 font-medium">{s.paid}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">{s.rate}%</td>
                      <td className="px-4 py-2.5">
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${s.rate >= 50 ? 'bg-green-500' : s.rate >= 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${s.rate}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
