'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, Download, AlertOctagon, Send } from 'lucide-react'
import { formatCurrency, formatDateBR } from '@/lib/utils'

interface Row {
  clientId: string
  name: string
  whatsapp: string | null
  cpfCnpj: string | null
  status: string
  planName: string | null
  openInvoices: number
  totalOwed: number
  oldestDueDate: string | null
  daysOverdue: number
  lastSent: { sentAt: string; stage: string } | null
}

const stageLabels: Record<string, string> = {
  D_MINUS_5: 'D-5', D_MINUS_2: 'D-2', D_ZERO: 'D-0',
  D_PLUS_1: 'D+1', D_PLUS_5: 'D+5', D_PLUS_10: 'D+10', D_PLUS_14: 'D+14',
}

export default function BloqueadosPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [order, setOrder] = useState<'oldest' | 'amount'>('oldest')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), order })
      if (q) params.set('q', q)
      const res = await fetch(`/api/inadimplencia/bloqueados?${params}`)
      if (res.ok) {
        const d = await res.json()
        setRows(d.rows || [])
        setTotal(d.total || 0)
        setPages(d.pages || 1)
      }
    } finally { setLoading(false) }
  }, [page, q, order])

  useEffect(() => { load() }, [load])

  const totalDevidoPagina = rows.reduce((s, r) => s + r.totalOwed, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Clientes Bloqueados (&gt;60 dias)</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} cliente(s) com fatura em aberto há mais de 60 dias — não recebem cobrança automática
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => window.open('/api/export?type=bloqueados', '_blank')}>
          <Download size={14} /> Exportar CSV
        </Button>
      </div>

      <Card className="mb-5">
        <CardContent className="py-3 flex gap-3 flex-wrap items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-gray-400" />
            <input
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400 dark:text-gray-200"
              placeholder="Buscar por nome..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            value={order}
            onChange={(e) => setOrder(e.target.value as 'oldest' | 'amount')}
          >
            <option value="oldest">Mais antigos primeiro</option>
            <option value="amount">Maiores valores primeiro</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <AlertOctagon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nenhum cliente bloqueado.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                      <th className="px-4 py-2 text-left">Cliente</th>
                      <th className="px-4 py-2 text-left">WhatsApp</th>
                      <th className="px-4 py-2 text-left">Plano</th>
                      <th className="px-4 py-2 text-center">Faturas</th>
                      <th className="px-4 py-2 text-right">Total devido</th>
                      <th className="px-4 py-2 text-center">Mais antiga</th>
                      <th className="px-4 py-2 text-center">Dias</th>
                      <th className="px-4 py-2 text-left">Última msg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.clientId} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800 dark:text-gray-200">{r.name}</div>
                          <div className="text-xs text-gray-400">{r.cpfCnpj || '—'}</div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{r.whatsapp || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{r.planName || '—'}</td>
                        <td className="px-4 py-2.5 text-center text-gray-700 dark:text-gray-300 text-xs">{r.openInvoices}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                          {formatCurrency(r.totalOwed)}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">
                          {r.oldestDueDate ? formatDateBR(r.oldestDueDate) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            r.daysOverdue >= 180 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                            r.daysOverdue >= 120 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}>
                            {r.daysOverdue}d
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {r.lastSent ? (
                            <>
                              <Badge variant="info">{stageLabels[r.lastSent.stage] || r.lastSent.stage}</Badge>
                              <span className="ml-1.5">{formatDateBR(r.lastSent.sentAt)}</span>
                            </>
                          ) : <span className="text-gray-300">nunca</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
                <div>
                  Página {page} de {pages} · <strong className="text-red-600 dark:text-red-400">{formatCurrency(totalDevidoPagina)}</strong> nesta página
                </div>
                {pages > 1 && (
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
                    <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-300">
        <Send size={14} className="inline mr-1" />
        Esses clientes <strong>não recebem mais cobrança automática</strong> da régua.
        Sugestão de fluxo manual: negativação (Serasa/SPC), proposta de acordo, suspensão do serviço ou ação judicial.
      </div>
    </div>
  )
}
