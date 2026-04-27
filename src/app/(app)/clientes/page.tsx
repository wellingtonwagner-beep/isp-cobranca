'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw, Users, Send, X, Loader2, CheckCircle, Download, Plus, Edit2, Trash2 } from 'lucide-react'
import { SortableTh } from '@/components/ui/sortable-th'

interface Client {
  id: string
  name: string
  cpfCnpj: string | null
  whatsapp: string | null
  phone: string | null
  email: string | null
  status: string
  city: string | null
  planName: string | null
  syncedAt: string
  _count: { invoices: number; messageLogs: number }
}

interface ClientForm {
  name: string
  cpfCnpj: string
  email: string
  phone: string
  whatsapp: string
  status: string
  city: string
}

const EMPTY_CLIENT_FORM: ClientForm = {
  name: '', cpfCnpj: '', email: '', phone: '', whatsapp: '', status: 'ativo', city: '',
}

interface Invoice {
  id: string
  externalId: string
  dueDate: string
  amount: number
  status: string
  boletoUrl: string | null
  pixCode: string | null
}

const statusBadge: Record<string, 'success' | 'danger' | 'muted' | 'warning'> = {
  ativo: 'success',
  suspenso: 'warning',
  cancelado: 'danger',
  inadimplente: 'danger',
}

const STAGES = [
  { id: 'D_MINUS_5', label: 'D-5 Lembrete Antecipado' },
  { id: 'D_MINUS_2', label: 'D-2 Envio do Boleto' },
  { id: 'D_ZERO', label: 'D-0 Dia do Vencimento' },
  { id: 'D_PLUS_1', label: 'D+1 Pós-Vencimento' },
  { id: 'D_PLUS_5', label: 'D+5 Regularização' },
  { id: 'D_PLUS_10', label: 'D+10 Última Facilidade' },
  { id: 'D_PLUS_14', label: 'D+14 Aviso de Suspensão' },
]

function formatCurrency(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'whatsapp' | 'city' | 'status' | 'invoices' | 'messageLogs'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [syncCountdown, setSyncCountdown] = useState(0)

  const [erpType, setErpType] = useState<string>('sgp')
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [creatingClient, setCreatingClient] = useState(false)
  const [clientForm, setClientForm] = useState<ClientForm>(EMPTY_CLIENT_FORM)
  const [savingClient, setSavingClient] = useState(false)
  const [clientFormError, setClientFormError] = useState<string | null>(null)

  const [sendModalClient, setSendModalClient] = useState<Client | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<string>('')
  const [selectedStage, setSelectedStage] = useState<string>('D_ZERO')
  const [forceTestMode, setForceTestMode] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), sortBy, sortDir })
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
  }, [page, q, status, sortBy, sortDir])

  function toggleSort(field: typeof sortBy) {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      if (d.user?.erpType) setErpType(d.user.erpType)
    })
  }, [])

  const isManual = erpType === 'manual'

  function openCreateClient() {
    setEditClient(null)
    setClientForm(EMPTY_CLIENT_FORM)
    setCreatingClient(true)
    setClientFormError(null)
  }

  function openEditClient(c: Client) {
    setEditClient(c)
    setClientForm({
      name: c.name,
      cpfCnpj: c.cpfCnpj || '',
      email: c.email || '',
      phone: c.phone || '',
      whatsapp: c.whatsapp || '',
      status: c.status,
      city: c.city || '',
    })
    setCreatingClient(true)
    setClientFormError(null)
  }

  function closeClientModal() {
    setCreatingClient(false)
    setEditClient(null)
    setClientFormError(null)
  }

  async function saveClient() {
    setSavingClient(true)
    setClientFormError(null)
    try {
      const url = editClient ? `/api/clientes/${editClient.id}` : '/api/clientes'
      const method = editClient ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientForm),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setClientFormError(d.error || `Erro ${res.status}`)
        return
      }
      closeClientModal()
      await load()
    } finally {
      setSavingClient(false)
    }
  }

  async function deleteClient(c: Client) {
    if (!confirm(`Excluir o cliente "${c.name}"?`)) return
    const res = await fetch(`/api/clientes/${c.id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(d.error || `Erro ${res.status}`)
      return
    }
    await load()
  }

  async function syncClients() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clientes' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSyncMsg({ ok: false, text: data.error || `Erro ${res.status}` })
      } else {
        setSyncMsg({ ok: true, text: data.message || 'Sync iniciado.' })
        setSyncCountdown(120)
        setTimeout(async () => {
          await load()
          setSyncMsg(null)
          setSyncCountdown(0)
        }, 120_000)
      }
    } catch (e) {
      setSyncMsg({ ok: false, text: String(e) })
    } finally {
      setSyncing(false)
    }
  }

  // Contador regressivo do auto-refresh
  useEffect(() => {
    if (syncCountdown <= 0) return
    const t = setInterval(() => setSyncCountdown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [syncCountdown])

  async function openSendModal(client: Client) {
    setSendModalClient(client)
    setSelectedInvoice('')
    setSelectedStage('D_ZERO')
    setSendResult(null)
    setForceTestMode(false)
    setLoadingInvoices(true)
    try {
      const res = await fetch(`/api/clientes/${client.id}/invoices`)
      const data = await res.json()
      setInvoices(data.invoices || [])
      if (data.invoices?.length > 0) setSelectedInvoice(data.invoices[0].id)
    } catch {
      setInvoices([])
    } finally {
      setLoadingInvoices(false)
    }
  }

  function closeSendModal() {
    setSendModalClient(null)
    setInvoices([])
    setSendResult(null)
  }

  async function sendMessage() {
    if (!sendModalClient || !selectedInvoice || !selectedStage) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/admin/send-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: sendModalClient.id,
          invoiceId: selectedInvoice,
          stage: selectedStage,
          force: true,
          testMode: forceTestMode,
        }),
      })
      const data = await res.json()
      setSendResult({ ok: data.ok, message: data.message || data.error || 'Erro desconhecido' })
    } catch (e) {
      setSendResult({ ok: false, message: String(e) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Clientes</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{total} clientes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.open('/api/export?type=clientes', '_blank')}>
            <Download size={14} /> Exportar CSV
          </Button>
          {isManual ? (
            <Button size="sm" onClick={openCreateClient}>
              <Plus size={14} /> Novo Cliente
            </Button>
          ) : (
            <Button size="sm" onClick={syncClients} loading={syncing}>
              <RefreshCw size={14} /> Sincronizar
            </Button>
          )}
        </div>
      </div>

      {syncMsg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3 ${syncMsg.ok ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
          <span>{syncMsg.text}</span>
          {syncMsg.ok && syncCountdown > 0 && (
            <span className="text-xs font-medium opacity-80 whitespace-nowrap">
              Atualizando em {Math.floor(syncCountdown / 60)}:{String(syncCountdown % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      )}

      <Card className="mb-5">
        <CardContent className="py-3 flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-gray-400" />
            <input
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400 dark:text-gray-200"
              placeholder="Buscar por nome, CPF, telefone..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !clients.length ? (
            <div className="py-12 text-center">
              <Users className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                      <SortableTh field="name" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>Nome</SortableTh>
                      <SortableTh field="whatsapp" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>WhatsApp</SortableTh>
                      <SortableTh field="city" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>Cidade</SortableTh>
                      <SortableTh field="status" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>Status</SortableTh>
                      <SortableTh field="invoices" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>Faturas</SortableTh>
                      <SortableTh field="messageLogs" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>Mensagens</SortableTh>
                      <th className="px-4 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800 dark:text-gray-200">{c.name}</div>
                          {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                          {c.whatsapp || c.phone || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{c.city || '—'}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={statusBadge[c.status] || 'muted'}>{c.status}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 text-xs">{c._count.invoices}</td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 text-xs">{c._count.messageLogs}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            {isManual && (
                              <>
                                <button
                                  onClick={() => openEditClient(c)}
                                  title="Editar cliente"
                                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => deleteClient(c)}
                                  title="Excluir cliente"
                                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => openSendModal(c)}
                              disabled={!c.whatsapp}
                              title={c.whatsapp ? 'Enviar cobrança manual' : 'Cliente sem WhatsApp'}
                              className="inline-flex items-center gap-1.5 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <Send size={12} /> Enviar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
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

      {/* Modal Criar/Editar cliente (só modo manual) */}
      {creatingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeClientModal}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button onClick={closeClientModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <ClientField label="Nome *">
                <input
                  className="client-form-input uppercase"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value.toUpperCase() })}
                  autoFocus
                  placeholder="NOME COMPLETO"
                />
              </ClientField>

              <div className="grid grid-cols-2 gap-3">
                <ClientField label="CPF / CNPJ">
                  <input
                    className="client-form-input"
                    value={clientForm.cpfCnpj}
                    onChange={(e) => setClientForm({ ...clientForm, cpfCnpj: e.target.value })}
                    placeholder="Somente números"
                  />
                </ClientField>
                <ClientField label="Status">
                  <select
                    className="client-form-input"
                    value={clientForm.status}
                    onChange={(e) => setClientForm({ ...clientForm, status: e.target.value })}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="suspenso">Suspenso</option>
                    <option value="inadimplente">Inadimplente</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </ClientField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ClientField label="WhatsApp">
                  <input
                    className="client-form-input"
                    value={clientForm.whatsapp}
                    onChange={(e) => setClientForm({ ...clientForm, whatsapp: e.target.value })}
                    placeholder="5537999999999"
                  />
                </ClientField>
                <ClientField label="Telefone (alternativo)">
                  <input
                    className="client-form-input"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    placeholder="(37) 3333-3333"
                  />
                </ClientField>
              </div>

              <ClientField label="E-mail">
                <input
                  className="client-form-input"
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  placeholder="cliente@exemplo.com"
                />
              </ClientField>

              <ClientField label="Cidade">
                <input
                  className="client-form-input uppercase"
                  value={clientForm.city}
                  onChange={(e) => setClientForm({ ...clientForm, city: e.target.value.toUpperCase() })}
                  placeholder="EX: PIUMHI"
                />
              </ClientField>

              {clientFormError && (
                <div className="px-3 py-2 rounded text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700">
                  {clientFormError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={closeClientModal}
                className="text-sm px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={saveClient}
                disabled={savingClient || !clientForm.name.trim()}
                className="inline-flex items-center gap-2 text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {savingClient ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>

          <style jsx>{`
            .client-form-input {
              width: 100%;
              padding: 0.5rem 0.75rem;
              border: 1px solid rgb(229 231 235);
              border-radius: 0.5rem;
              font-size: 0.875rem;
              background: white;
              color: rgb(17 24 39);
              outline: none;
            }
            .client-form-input:focus {
              border-color: rgb(168 85 247);
              box-shadow: 0 0 0 2px rgb(168 85 247 / 0.2);
            }
            :global(.dark) .client-form-input {
              background: rgb(55 65 81);
              border-color: rgb(75 85 99);
              color: rgb(229 231 235);
            }
          `}</style>
        </div>
      )}

      {/* Modal de envio manual */}
      {sendModalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeSendModal}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Enviar Cobrança</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sendModalClient.name}</p>
              </div>
              <button onClick={closeSendModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Send size={16} className="text-purple-600 dark:text-purple-400" />
                <div className="text-sm">
                  <div className="text-gray-700 dark:text-gray-300 font-medium">WhatsApp:</div>
                  <div className="text-gray-500 dark:text-gray-400">{sendModalClient.whatsapp || '—'}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Fatura</label>
                {loadingInvoices ? (
                  <div className="text-sm text-gray-400 py-3">Carregando faturas...</div>
                ) : invoices.length === 0 ? (
                  <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                    Nenhuma fatura em aberto para este cliente.
                  </div>
                ) : (
                  <select
                    value={selectedInvoice}
                    onChange={(e) => setSelectedInvoice(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {formatDate(inv.dueDate)} · {formatCurrency(inv.amount)} · {inv.status}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Estágio da mensagem</label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1.5">
                  O texto é o mesmo da cobrança automática deste estágio (pode ser personalizado em Workflow).
                </p>
              </div>

              <label className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceTestMode}
                  onChange={(e) => setForceTestMode(e.target.checked)}
                  className="rounded"
                />
                <div className="text-sm">
                  <span className="font-medium text-amber-800 dark:text-amber-300">Forçar modo teste</span>
                  <div className="text-xs text-amber-700 dark:text-amber-400">Se marcado, a mensagem não será enviada de verdade (apenas registrada).</div>
                </div>
              </label>

              {sendResult && (
                <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                  sendResult.ok
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                }`}>
                  {sendResult.ok ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <span className="shrink-0">&#10060;</span>}
                  <span>{sendResult.message}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={closeSendModal}
                className="text-sm px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
              >
                Fechar
              </button>
              <button
                onClick={sendMessage}
                disabled={sending || !selectedInvoice || invoices.length === 0}
                className="inline-flex items-center gap-2 text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {sending
                  ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                  : <><Send size={14} /> Enviar Cobrança</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClientField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  )
}

