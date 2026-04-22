'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, CheckCircle, XCircle, Clock, RefreshCw, Download, Filter } from 'lucide-react'
import { formatDateBR, formatCurrency } from '@/lib/utils'

interface CobrancaLog {
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

interface CobrancaData {
  summary: { planned: number; sent: number; blocked: number; failed: number; pending: number }
  stagePreview: { stage: string; label: string; count: number; targetDate: string }[]
  todayLogs: CobrancaLog[]
  recentLogs: CobrancaLog[]
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
}

export default function CobrancasPage() {
  const [data, setData] = useState<CobrancaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filterStage, setFilterStage] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/cobrancas')
      const json = await res.json()
      setData(json)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function triggerCron() {
    if (triggering) return
    if (!confirm('Disparar cobranças agora? Isso pode levar alguns minutos dependendo do volume. Não recarregue a página nem clique novamente.')) return
    setTriggering(true)
    setTriggerMsg(null)
    try {
      const res = await fetch('/api/admin/cron', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTriggerMsg({ ok: false, text: data.error || `Erro ${res.status}` })
      } else {
        const r = data.result
        setTriggerMsg({
          ok: true,
          text: `Disparo concluído: ${r?.totalSent || 0} enviadas, ${r?.totalSkipped || 0} puladas, ${r?.totalErrors || 0} erros.`,
        })
      }
      await load()
    } catch (err) {
      setTriggerMsg({ ok: false, text: String(err) })
    } finally {
      setTriggering(false)
    }
  }

  useEffect(() => { load() }, [])

  const summary = data?.summary

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Central de Cobranças</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gestão completa dos disparos de cobrança via WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.open('/api/export?type=cobrancas', '_blank')}>
            <Download size={14} /> Exportar CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={load} loading={loading}>
            <RefreshCw size={14} /> Atualizar
          </Button>
          <Button size="sm" onClick={triggerCron} loading={triggering}>
            <MessageSquare size={14} /> Disparar Agora
          </Button>
        </div>
      </div>

      {triggerMsg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${triggerMsg.ok ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
          {triggerMsg.text}
        </div>
      )}

      {triggering && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Disparando cobranças... Aguarde, isso pode levar alguns minutos.
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          title="Previstos Hoje"
          value={summary?.planned ?? 0}
          sub="faturas em 6 estágios"
          icon={Clock}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-50 dark:bg-purple-900/30"
        />
        <SummaryCard
          title="Enviados"
          value={summary?.sent ?? 0}
          sub="entregues via WhatsApp"
          icon={CheckCircle}
          color="text-green-600 dark:text-green-400"
          bg="bg-green-50 dark:bg-green-900/30"
        />
        <SummaryCard
          title="Bloqueados (teste)"
          value={summary?.blocked ?? 0}
          sub="modo teste ativo"
          icon={XCircle}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-50 dark:bg-amber-900/30"
        />
        <SummaryCard
          title="Pendentes"
          value={summary?.pending ?? 0}
          sub="aguardando próximo cron"
          icon={Clock}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-900/30"
        />
      </div>

      {/* Previstos para hoje */}
      {data?.stagePreview && data.stagePreview.length > 0 && (
        <Card className="mb-6">
          <div className="px-5 py-3 border-b border-purple-50 dark:border-gray-700">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">Previstos para Hoje</h2>
          </div>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {data.stagePreview.map((s) => (
                <div key={s.stage} className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/30 px-3 py-2 rounded-lg">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300">{stageLabels[s.stage]}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{s.label}</span>
                  <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 bg-purple-200 dark:bg-purple-800 px-1.5 py-0.5 rounded-full">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros + Histórico de Envios */}
      <Card className="mb-5">
        <CardContent className="py-3 flex gap-3 flex-wrap items-center">
          <Filter size={14} className="text-gray-400" />
          <select
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
          >
            <option value="">Todos os estágios</option>
            <option value="D_MINUS_5">D-5</option>
            <option value="D_MINUS_2">D-2</option>
            <option value="D_ZERO">D-0</option>
            <option value="D_PLUS_1">D+1</option>
            <option value="D_PLUS_5">D+5</option>
            <option value="D_PLUS_10">D+10</option>
            <option value="D_PLUS_14">D+14</option>
          </select>
          <select
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="sent">Enviado</option>
            <option value="blocked_test">Bloqueado (teste)</option>
            <option value="failed">Falhou</option>
            <option value="skipped_paid">Já pago</option>
            <option value="skipped_no_phone">Sem telefone</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <div className="px-5 py-3 border-b border-purple-50 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">Histórico de Envios</h2>
          <p className="text-xs text-gray-400 mt-0.5">Últimos 7 dias</p>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !data?.recentLogs?.length ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Nenhum envio registrado nos últimos 7 dias.
            </div>
          ) : (() => {
            const filtered = data.recentLogs.filter((log) => {
              if (filterStage && log.stage !== filterStage) return false
              if (filterStatus && log.status !== filterStatus) return false
              return true
            })
            return filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                Nenhum envio encontrado com os filtros selecionados.
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-4 py-2 text-left">Cliente</th>
                    <th className="px-4 py-2 text-left">Estágio</th>
                    <th className="px-4 py-2 text-left">Valor</th>
                    <th className="px-4 py-2 text-left">Vencimento</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Enviado em</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => {
                    const sc = statusConfig[log.status] || { label: log.status, variant: 'muted' as const }
                    return (
                      <tr key={log.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800 dark:text-gray-200">{log.client?.name}</div>
                          <div className="text-xs text-gray-400">{log.whatsappTo}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                            {stageLabels[log.stage] || log.stage}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                          {formatCurrency(log.invoice?.amount || 0)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                          {log.invoice?.dueDate ? formatDateBR(log.invoice.dueDate) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span title={log.errorMessage || undefined}>
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                          </span>
                          {log.testMode && (
                            <Badge variant="info" className="ml-1">teste</Badge>
                          )}
                          {log.errorMessage && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-xs truncate" title={log.errorMessage}>
                              {log.errorMessage}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">
                          {new Date(log.sentAt).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  title, value, sub, icon: Icon, color, bg,
}: {
  title: string; value: number; sub: string; icon: React.ElementType; color: string; bg: string
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className={`${bg} w-8 h-8 rounded-lg flex items-center justify-center mb-3`}>
          <Icon className={`${color} w-4 h-4`} />
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5">{title}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </CardContent>
    </Card>
  )
}
