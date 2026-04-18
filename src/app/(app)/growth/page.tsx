'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, Users, DollarSign, MessageSquare } from 'lucide-react'

interface GrowthData {
  totalClients: number
  newClientsThisMonth: number
  newClientsLastMonth: number
  totalOpenAmountFormatted: string
  sentThisMonth: number
  sentLastMonth: number
  stageStats: { stage: string; _count: { stage: number } }[]
}

const stageLabels: Record<string, string> = {
  D_MINUS_5: 'D-5 Lembrete', D_MINUS_2: 'D-2 Boleto', D_ZERO: 'D-0 Vencimento',
  D_PLUS_1: 'D+1 Pós-Vencimento', D_PLUS_5: 'D+5 Regularização',
  D_PLUS_10: 'D+10 Última Facilidade', D_PLUS_14: 'D+14 Suspensão',
}

export default function GrowthPage() {
  const [data, setData] = useState<GrowthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/growth')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-20 text-center text-gray-400">Carregando...</div>
  if (!data) return <div className="py-20 text-center text-gray-400">Erro ao carregar dados.</div>

  const clientGrowth = data.newClientsLastMonth > 0
    ? ((data.newClientsThisMonth - data.newClientsLastMonth) / data.newClientsLastMonth * 100).toFixed(1)
    : null

  const msgGrowth = data.sentLastMonth > 0
    ? ((data.sentThisMonth - data.sentLastMonth) / data.sentLastMonth * 100).toFixed(1)
    : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Growth</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Métricas de crescimento e desempenho do sistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Clientes Ativos"
          value={data.totalClients}
          sub={`+${data.newClientsThisMonth} este mês`}
          growth={clientGrowth}
          icon={Users}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-50 dark:bg-purple-900/30"
        />
        <MetricCard
          title="Em Aberto (R$)"
          value={data.totalOpenAmountFormatted}
          sub="faturas abertas + vencidas"
          icon={DollarSign}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-50 dark:bg-amber-900/30"
        />
        <MetricCard
          title="Mensagens Enviadas"
          value={data.sentThisMonth}
          sub="este mês (enviadas)"
          growth={msgGrowth}
          icon={MessageSquare}
          color="text-green-600 dark:text-green-400"
          bg="bg-green-50 dark:bg-green-900/30"
        />
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-purple-50 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">Mensagens por Estágio (este mês)</h2>
        </div>
        <CardContent>
          {data.stageStats.length === 0 ? (
            <p className="text-gray-400 text-sm py-4">Nenhum envio registrado este mês.</p>
          ) : (
            <div className="space-y-3">
              {data.stageStats
                .sort((a, b) => b._count.stage - a._count.stage)
                .map((s) => {
                  const max = Math.max(...data.stageStats.map((x) => x._count.stage))
                  const pct = max > 0 ? (s._count.stage / max) * 100 : 0
                  return (
                    <div key={s.stage} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-40 shrink-0">
                        {stageLabels[s.stage] || s.stage}
                      </span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{s._count.stage}</span>
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>
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
