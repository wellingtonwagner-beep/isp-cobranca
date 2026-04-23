'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, PhoneOff, Copy, FlaskConical, CircleDollarSign, Download, RefreshCw } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface LogEntry {
  id: string
  stage: string
  status: string
  whatsappTo: string
  testMode: boolean
  sentAt: string
  errorMessage?: string | null
  client: { name: string; whatsapp: string }
  invoice: { amount: number; dueDate: string }
}

interface ReportData {
  date: string
  summary: {
    total: number
    sent: number
    failed: number
    blocked_test: number
    skipped_no_phone: number
    skipped_paid: number
    blocked_duplicate: number
    blocked_window: number
    blocked_holiday: number
  }
  failureReasons: { reason: string; count: number }[]
  logs: LogEntry[]
  failedLogs: LogEntry[]
}

const stageLabels: Record<string, string> = {
  D_MINUS_5: 'D-5', D_MINUS_2: 'D-2', D_ZERO: 'D-0',
  D_PLUS_1: 'D+1', D_PLUS_5: 'D+5', D_PLUS_10: 'D+10', D_PLUS_14: 'D+14',
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' | 'info' }> = {
  sent: { label: 'Enviado', variant: 'success' },
  blocked_test: { label: 'Bloqueado (teste)', variant: 'warning' },
  failed: { label: 'Falhou', variant: 'danger' },
  skipped_paid: { label: 'Já pago', variant: 'muted' },
  skipped_no_phone: { label: 'Sem telefone', variant: 'muted' },
  blocked_duplicate: { label: 'Duplicata', variant: 'info' },
  blocked_window: { label: 'Fora janela', variant: 'muted' },
  blocked_holiday: { label: 'Feriado', variant: 'muted' },
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function RelatorioDiarioPage() {
  const [date, setDate] = useState(todayStr())
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/relatorios/diario?date=${date}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  function exportCsv() {
    window.open(`/api/export?type=cobrancas&from=${date}&to=${date}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Relatório Diário</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Mensagens entregues, falhas e motivos no dia selecionado
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayStr()}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <Button variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={exportCsv} disabled={!data?.logs?.length}>
            <Download className="w-4 h-4 mr-1" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <SummaryCard title="Total" value={data?.summary.total ?? 0} icon={CircleDollarSign} color="text-gray-700 dark:text-gray-300" bg="bg-gray-100 dark:bg-gray-800" />
        <SummaryCard title="Entregues" value={data?.summary.sent ?? 0} icon={CheckCircle} color="text-green-600" bg="bg-green-100 dark:bg-green-900/30" />
        <SummaryCard title="Falhas" value={data?.summary.failed ?? 0} icon={XCircle} color="text-red-600" bg="bg-red-100 dark:bg-red-900/30" />
        <SummaryCard title="Sem telefone" value={data?.summary.skipped_no_phone ?? 0} icon={PhoneOff} color="text-gray-500" bg="bg-gray-100 dark:bg-gray-800" />
        <SummaryCard title="Duplicadas" value={data?.summary.blocked_duplicate ?? 0} icon={Copy} color="text-blue-600" bg="bg-blue-100 dark:bg-blue-900/30" />
        <SummaryCard title="Modo teste" value={data?.summary.blocked_test ?? 0} icon={FlaskConical} color="text-amber-600" bg="bg-amber-100 dark:bg-amber-900/30" />
      </div>

      {/* Motivos de falha */}
      {data?.failureReasons && data.failureReasons.length > 0 && (
        <Card>
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Motivos de não entrega</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Agrupados por mensagem de erro</p>
          </div>
          <CardContent>
            <div className="space-y-2">
              {data.failureReasons.map((r) => (
                <div key={r.reason} className="flex items-start gap-3 p-2 rounded bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                  <span className="font-bold text-red-700 dark:text-red-400 text-sm min-w-[2rem] text-right">{r.count}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 break-words flex-1">{r.reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela detalhada de falhas */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Mensagens não entregues</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Falhas, sem telefone e duplicadas</p>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !data?.failedLogs?.length ? (
            <div className="py-12 text-center text-gray-400 text-sm">Nenhuma falha registrada neste dia.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-4 py-2 text-left">Cliente</th>
                    <th className="px-4 py-2 text-left">WhatsApp</th>
                    <th className="px-4 py-2 text-left">Estágio</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Motivo</th>
                    <th className="px-4 py-2 text-left">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {data.failedLogs.map((log) => {
                    const sc = statusConfig[log.status] || { label: log.status, variant: 'muted' as const }
                    return (
                      <tr key={log.id} className="border-b border-gray-50 dark:border-gray-700/50">
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{log.client?.name}</td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{log.whatsappTo || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                            {stageLabels[log.stage] || log.stage}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={sc.variant}>{sc.label}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-red-600 dark:text-red-400 max-w-md break-words">
                          {log.errorMessage || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(log.sentAt).toLocaleTimeString('pt-BR')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela completa */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Todas as mensagens do dia</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{data?.logs?.length || 0} registros</p>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !data?.logs?.length ? (
            <div className="py-12 text-center text-gray-400 text-sm">Nenhuma mensagem registrada neste dia.</div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-4 py-2 text-left">Cliente</th>
                    <th className="px-4 py-2 text-left">Estágio</th>
                    <th className="px-4 py-2 text-left">Valor</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => {
                    const sc = statusConfig[log.status] || { label: log.status, variant: 'muted' as const }
                    return (
                      <tr key={log.id} className="border-b border-gray-50 dark:border-gray-700/50">
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">
                          <div>{log.client?.name}</div>
                          <div className="text-xs text-gray-400">{log.whatsappTo || '—'}</div>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                            {stageLabels[log.stage] || log.stage}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {formatCurrency(log.invoice?.amount || 0)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant={sc.variant}>{sc.label}</Badge>
                        </td>
                        <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(log.sentAt).toLocaleTimeString('pt-BR')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  title, value, icon: Icon, color, bg,
}: { title: string; value: number; icon: React.ElementType; color: string; bg: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className={`${bg} w-8 h-8 rounded-lg flex items-center justify-center mb-2`}>
          <Icon className={`${color} w-4 h-4`} />
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{title}</p>
      </CardContent>
    </Card>
  )
}
