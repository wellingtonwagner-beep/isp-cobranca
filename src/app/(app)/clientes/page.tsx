'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw, Users } from 'lucide-react'

interface Client {
  id: string
  name: string
  whatsapp: string | null
  phone: string | null
  email: string | null
  status: string
  city: string | null
  planName: string | null
  syncedAt: string
  _count: { invoices: number; messageLogs: number }
}

const statusBadge: Record<string, 'success' | 'danger' | 'muted' | 'warning'> = {
  ativo: 'success',
  suspenso: 'warning',
  cancelado: 'danger',
  inadimplente: 'danger',
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (q) params.set('q', q)
      if (status) params.set('status', status)
      const res = await fetch(`/api/clientes?${params}`)
      const data = await res.json()
      setClients(data.clients || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
    } finally {
      setLoading(false)
    }
  }, [page, q, status])

  useEffect(() => { load() }, [load])

  async function syncClients() {
    setSyncing(true)
    try {
      await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clientes' }),
      })
      await load()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">{total} clientes cadastrados</p>
        </div>
        <Button size="sm" onClick={syncClients} loading={syncing}>
          <RefreshCw size={14} /> Sincronizar SGP
        </Button>
      </div>

      {/* Filtros */}
      <Card className="mb-5">
        <CardContent className="py-3 flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-gray-400" />
            <input
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
              placeholder="Buscar por nome, CPF, telefone..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="suspenso">Suspenso</option>
            <option value="inadimplente">Inadimplente</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !clients.length ? (
            <div className="py-12 text-center">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="px-4 py-2 text-left">Nome</th>
                      <th className="px-4 py-2 text-left">WhatsApp</th>
                      <th className="px-4 py-2 text-left">Cidade</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Faturas</th>
                      <th className="px-4 py-2 text-left">Mensagens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800">{c.name}</div>
                          {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                          {c.whatsapp || c.phone || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{c.city || '—'}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={statusBadge[c.status] || 'muted'}>{c.status}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{c._count.invoices}</td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{c._count.messageLogs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
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
