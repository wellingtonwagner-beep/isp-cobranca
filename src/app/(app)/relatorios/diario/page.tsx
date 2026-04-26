'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, PhoneOff, Copy, FlaskConical, CircleDollarSign, Download, RefreshCw, Send } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { SortableTh, toggleSort, type SortDir } from '@/components/ui/sortable-th'

const RETRYABLE_STATUS = new Set(['failed', 'blocked_duplicate', 'blocked_window', 'blocked_holiday', 'skipped_no_phone'])

interface LogEntry {
  id: string
  stage: string
  status: string
  whatsappTo: string
  testMode: boolean
  sentAt: string
  errorMessage?: string | null
  client: { name: string; whatsapp: string | null }
  invoice: { amount: number; dueDate: string }
}

const STATUS_WITH_PHONE_REQUIRED = new Set(['skipped_no_phone'])

function canRetryLog(log: LogEntry): boolean {
  if (!RETRYABLE_STATUS.has(log.status)) return false
  // Para 'skipped_no_phone', so eh retentavel se o cliente JA TEM WhatsApp cadastrado agora
  if (STATUS_WITH_PHONE_REQUIRED.has(log.status) && !log.client?.whatsapp) return false
  return true
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [failedPage, setFailedPage] = useState(1)
  const [logsPage, setLogsPage] = useState(1)
  const PAGE_SIZE = 10

  type FailedSortField = 'client' | 'whatsapp' | 'stage' | 'status' | 'sentAt'
  const [failedSortBy, setFailedSortBy] = useState<FailedSortField>('sentAt')
  const [failedSortDir, setFailedSortDir] = useState<SortDir>('desc')
  function handleFailedSort(f: FailedSortField) {
    const next = toggleSort({ sortBy: failedSortBy, sortDir: failedSortDir }, f)
    setFailedSortBy(next.sortBy); setFailedSortDir(next.sortDir); setFailedPage(1)
  }

  type LogsSortField = 'client' | 'stage' | 'amount' | 'status' | 'sentAt'
  const [logsSortBy, setLogsSortBy] = useState<LogsSortField>('sentAt')
  const [logsSortDir, setLogsSortDir] = useState<SortDir>('desc')
  function handleLogsSort(f: LogsSortField) {
    const next = toggleSort({ sortBy: logsSortBy, sortDir: logsSortDir }, f)
    setLogsSortBy(next.sortBy); setLogsSortDir(next.sortDir); setLogsPage(1)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    setResendMsg(null)
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllRetryable() {
    if (!data) return
    const ids = data.failedLogs.filter((l) => canRetryLog(l)).map((l) => l.id)
    setSelected(new Set(ids))
  }

  function clearSelection() { setSelected(new Set()) }

  async function resend(all: boolean) {
    if (!data) return
    const retryableLogs = data.failedLogs.filter((l) => canRetryLog(l))
    const ids = all ? retryableLogs.map((l) => l.id) : Array.from(selected)
    if (ids.length === 0) {
      setResendMsg({ ok: false, text: 'Selecione ao menos uma mensagem para reenviar.' })
      return
    }
    if (!confirm(`Confirma o reenvio de ${ids.length} mensagem(ns)?`)) return

    setResending(true)
    setResendMsg(null)
    try {
      const res = await fetch('/api/relatorios/diario/reenviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, logIds: ids }),
      })
      const result = await res.json().catch(() => ({}))
      setResendMsg({ ok: !!result.ok, text: result.message || result.error || `Erro ${res.status}` })
      if (result.ok) await load()
    } catch (err) {
      setResendMsg({ ok: false, text: String(err) })
    } finally {
      setResending(false)
    }
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
              onChange={(e) => { setDate(e.target.value); setFailedPage(1); setLogsPage(1) }}
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
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Mensagens não entregues</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Falhas, sem telefone e duplicadas{selected.size > 0 ? ` — ${selected.size} selecionada(s)` : ''}
            </p>
          </div>
          {data?.failedLogs && data.failedLogs.some((l) => canRetryLog(l)) && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={selectAllRetryable}
                disabled={resending}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Selecionar todas
              </button>
              {selected.size > 0 && (
                <button
                  onClick={clearSelection}
                  disabled={resending}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Limpar
                </button>
              )}
              <Button
                size="sm"
                onClick={() => resend(false)}
                disabled={resending || selected.size === 0}
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                {resending ? 'Reenviando...' : `Reenviar selecionadas (${selected.size})`}
              </Button>
            </div>
          )}
        </div>
        {resendMsg && (
          <div className={`px-5 py-3 text-sm ${resendMsg.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'}`}>
            {resendMsg.text}
          </div>
        )}
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !data?.failedLogs?.length ? (
            <div className="py-12 text-center text-gray-400 text-sm">Nenhuma falha registrada neste dia.</div>
          ) : (() => {
            const fdir = failedSortDir === 'asc' ? 1 : -1
            const failedSorted = [...data.failedLogs].sort((a, b) => {
              let av: string = ''
              let bv: string = ''
              if (failedSortBy === 'client') { av = a.client?.name || ''; bv = b.client?.name || '' }
              else if (failedSortBy === 'whatsapp') { av = a.whatsappTo || a.client?.whatsapp || ''; bv = b.whatsappTo || b.client?.whatsapp || '' }
              else if (failedSortBy === 'stage') { av = a.stage; bv = b.stage }
              else if (failedSortBy === 'status') { av = a.status; bv = b.status }
              else if (failedSortBy === 'sentAt') { av = a.sentAt; bv = b.sentAt }
              if (av < bv) return -1 * fdir
              if (av > bv) return 1 * fdir
              return 0
            })
            const totalFailed = failedSorted.length
            const failedPages = Math.max(1, Math.ceil(totalFailed / PAGE_SIZE))
            const safeFailedPage = Math.min(failedPage, failedPages)
            const failedPaginated = failedSorted.slice((safeFailedPage - 1) * PAGE_SIZE, safeFailedPage * PAGE_SIZE)
            return (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-3 py-2 w-10"></th>
                    <SortableTh field="client" sortBy={failedSortBy} sortDir={failedSortDir} onSort={handleFailedSort}>Cliente</SortableTh>
                    <SortableTh field="whatsapp" sortBy={failedSortBy} sortDir={failedSortDir} onSort={handleFailedSort}>WhatsApp</SortableTh>
                    <SortableTh field="stage" sortBy={failedSortBy} sortDir={failedSortDir} onSort={handleFailedSort}>Estágio</SortableTh>
                    <SortableTh field="status" sortBy={failedSortBy} sortDir={failedSortDir} onSort={handleFailedSort}>Status</SortableTh>
                    <th className="px-4 py-2 text-left">Motivo</th>
                    <SortableTh field="sentAt" sortBy={failedSortBy} sortDir={failedSortDir} onSort={handleFailedSort}>Hora</SortableTh>
                  </tr>
                </thead>
                <tbody>
                  {failedPaginated.map((log) => {
                    const sc = statusConfig[log.status] || { label: log.status, variant: 'muted' as const }
                    const canRetry = canRetryLog(log)
                    const phoneNowAvailable = log.status === 'skipped_no_phone' && log.client?.whatsapp
                    return (
                      <tr key={log.id} className={`border-b border-gray-50 dark:border-gray-700/50 ${selected.has(log.id) ? 'bg-purple-50/40 dark:bg-purple-900/10' : ''}`}>
                        <td className="px-3 py-2.5 text-center">
                          {canRetry ? (
                            <input
                              type="checkbox"
                              checked={selected.has(log.id)}
                              onChange={() => toggleSelect(log.id)}
                              disabled={resending}
                              className="rounded"
                              title={phoneNowAvailable ? 'WhatsApp foi cadastrado depois — pronto para reenviar' : undefined}
                            />
                          ) : (
                            <span className="text-gray-300 dark:text-gray-700 text-xs" title="Cliente ainda sem WhatsApp cadastrado">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{log.client?.name}</td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                          {log.whatsappTo || (
                            log.client?.whatsapp
                              ? <span className="text-green-600 dark:text-green-400" title="Cadastrado depois do envio">{log.client.whatsapp} ✓</span>
                              : '—'
                          )}
                        </td>
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
            {failedPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-400">Página {safeFailedPage} de {failedPages} · {totalFailed} falha(s)</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={safeFailedPage <= 1} onClick={() => setFailedPage(safeFailedPage - 1)}>Anterior</Button>
                  <Button variant="secondary" size="sm" disabled={safeFailedPage >= failedPages} onClick={() => setFailedPage(safeFailedPage + 1)}>Próxima</Button>
                </div>
              </div>
            )}
            </>
            )
          })()}
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
          ) : (() => {
            const ldir = logsSortDir === 'asc' ? 1 : -1
            const logsSorted = [...data.logs].sort((a, b) => {
              let av: string | number = ''
              let bv: string | number = ''
              if (logsSortBy === 'client') { av = a.client?.name || ''; bv = b.client?.name || '' }
              else if (logsSortBy === 'stage') { av = a.stage; bv = b.stage }
              else if (logsSortBy === 'amount') { av = a.invoice?.amount || 0; bv = b.invoice?.amount || 0 }
              else if (logsSortBy === 'status') { av = a.status; bv = b.status }
              else if (logsSortBy === 'sentAt') { av = a.sentAt; bv = b.sentAt }
              if (av < bv) return -1 * ldir
              if (av > bv) return 1 * ldir
              return 0
            })
            const totalLogs = logsSorted.length
            const logsPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE))
            const safeLogsPage = Math.min(logsPage, logsPages)
            const logsPaginated = logsSorted.slice((safeLogsPage - 1) * PAGE_SIZE, safeLogsPage * PAGE_SIZE)
            return (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <SortableTh field="client" sortBy={logsSortBy} sortDir={logsSortDir} onSort={handleLogsSort}>Cliente</SortableTh>
                    <SortableTh field="stage" sortBy={logsSortBy} sortDir={logsSortDir} onSort={handleLogsSort}>Estágio</SortableTh>
                    <SortableTh field="amount" sortBy={logsSortBy} sortDir={logsSortDir} onSort={handleLogsSort}>Valor</SortableTh>
                    <SortableTh field="status" sortBy={logsSortBy} sortDir={logsSortDir} onSort={handleLogsSort}>Status</SortableTh>
                    <SortableTh field="sentAt" sortBy={logsSortBy} sortDir={logsSortDir} onSort={handleLogsSort}>Hora</SortableTh>
                  </tr>
                </thead>
                <tbody>
                  {logsPaginated.map((log) => {
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
            {logsPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-400">Página {safeLogsPage} de {logsPages} · {totalLogs} registros</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={safeLogsPage <= 1} onClick={() => setLogsPage(safeLogsPage - 1)}>Anterior</Button>
                  <Button variant="secondary" size="sm" disabled={safeLogsPage >= logsPages} onClick={() => setLogsPage(safeLogsPage + 1)}>Próxima</Button>
                </div>
              </div>
            )}
            </>
            )
          })()}
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
