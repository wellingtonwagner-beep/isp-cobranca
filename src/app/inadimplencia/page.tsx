'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { formatDateBR, formatCurrency } from '@/lib/utils'

interface InadimplenciaInvoice {
  id: string
  dueDate: string
  amount: number
  daysOverdue: number
  client: { id: string; name: string; whatsapp: string | null; phone: string | null; status: string }
  messageLogs: { stage: string; sentAt: string; status: string }[]
}

const stageLabels: Record<string, string> = {
  D_MINUS_5: 'D-5', D_MINUS_2: 'D-2', D_ZERO: 'D-0',
  D_PLUS_1: 'D+1', D_PLUS_5: 'D+5', D_PLUS_10: 'D+10', D_PLUS_14: 'D+14',
}

function getDaysVariant(days: number): 'warning' | 'danger' | 'muted' {
  if (days <= 5) return 'warning'
  if (days <= 14) return 'danger'
  return 'danger'
}

export default function InadimplenciaPage() {
  const [invoices, setInvoices] = useState<InadimplenciaInvoice[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inadimplencia?page=${page}`)
      const data = await res.json()
      setInvoices(data.invoices || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inadimplência</h1>
          <p className="text-gray-500 text-sm mt-1">{total} faturas em atraso</p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}>
          <RefreshCw size={14} /> Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !invoices.length ? (
            <div className="py-12 text-center">
              <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nenhuma fatura em atraso. Ótimo!</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="px-4 py-2 text-left">Cliente</th>
                      <th className="px-4 py-2 text-left">Vencimento</th>
                      <th className="px-4 py-2 text-left">Valor</th>
                      <th className="px-4 py-2 text-left">Dias Atraso</th>
                      <th className="px-4 py-2 text-left">Último Contato</th>
                      <th className="px-4 py-2 text-left">WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800">{inv.client.name}</div>
                          <Badge variant={inv.client.status === 'ativo' ? 'success' : 'warning'} className="mt-0.5">
                            {inv.client.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                          {formatDateBR(inv.dueDate)}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-700">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={getDaysVariant(inv.daysOverdue)}>
                            D+{inv.daysOverdue}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {inv.messageLogs[0] ? (
                            <div>
                              <span className="font-medium text-purple-600">
                                {stageLabels[inv.messageLogs[0].stage] || inv.messageLogs[0].stage}
                              </span>
                              <div className="text-gray-400">
                                {new Date(inv.messageLogs[0].sentAt).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">Sem contato</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                          {inv.client.whatsapp || inv.client.phone || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Página {page} de {pages}</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      Anterior
                    </Button>
                    <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
