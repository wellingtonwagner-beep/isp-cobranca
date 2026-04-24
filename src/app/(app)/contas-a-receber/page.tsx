'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Plus, CheckCircle, X, Loader2, Search, Trash2, Undo2 } from 'lucide-react'

interface Invoice {
  id: string
  sequentialNumber: number | null
  dueDate: string
  amount: number
  status: string
  description: string | null
  paidAt: string | null
  paidVia: string | null
  paymentNote: string | null
  pixTxid: string | null
  client: { id: string; name: string; whatsapp: string | null; cpfCnpj: string | null }
  product: { id: string; name: string; recurrence: string } | null
}

interface ClientOption { id: string; name: string }
interface ProductOption { id: string; name: string; amount: number; recurrence: string }

const statusBadge: Record<string, 'success' | 'warning' | 'danger' | 'muted' | 'info'> = {
  aberta: 'warning',
  vencida: 'danger',
  paga: 'success',
  cancelada: 'muted',
}

function formatCurrency(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ContasAReceberPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [erpBlock, setErpBlock] = useState(false)

  // Filtros
  const [filterStatus, setFilterStatus] = useState('')
  const [filterQ, setFilterQ] = useState('')

  // Nova fatura
  const [creating, setCreating] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [newInv, setNewInv] = useState({ clientId: '', productId: '', amount: '', dueDate: todayStr(), description: '' })
  const [savingNew, setSavingNew] = useState(false)
  const [newError, setNewError] = useState<string | null>(null)

  // Baixa manual
  const [baixaInvoice, setBaixaInvoice] = useState<Invoice | null>(null)
  const [baixaMethod, setBaixaMethod] = useState('pix')
  const [baixaNote, setBaixaNote] = useState('')
  const [savingBaixa, setSavingBaixa] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (filterStatus) params.set('status', filterStatus)
      if (filterQ) params.set('q', filterQ)
      const res = await fetch(`/api/invoices/manual?${params}`)
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
        setTotal(data.total || 0)
        setPages(data.pages || 1)
      }
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus, filterQ])

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      if (d.user?.erpType !== 'manual') setErpBlock(true)
    })
    load()
  }, [load])

  async function openNewInvoice() {
    // Carrega clientes e produtos ativos na hora de abrir
    const [cRes, pRes] = await Promise.all([
      fetch('/api/clientes?limit=500'),
      fetch('/api/produtos'),
    ])
    const cData = await cRes.json()
    const pData = await pRes.json()
    setClients((cData.clients || []).map((c: ClientOption) => ({ id: c.id, name: c.name })))
    setProducts(pData.products || [])
    setNewInv({ clientId: '', productId: '', amount: '', dueDate: todayStr(), description: '' })
    setNewError(null)
    setCreating(true)
  }

  function handleProductChange(productId: string) {
    const p = products.find((p) => p.id === productId)
    setNewInv({ ...newInv, productId, amount: p ? String(p.amount) : newInv.amount })
  }

  async function saveNew() {
    setSavingNew(true)
    setNewError(null)
    try {
      const res = await fetch('/api/invoices/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: newInv.clientId,
          productId: newInv.productId || undefined,
          amount: parseFloat(newInv.amount.replace(',', '.')),
          dueDate: newInv.dueDate,
          description: newInv.description,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setNewError(d.error || `Erro ${res.status}`); return }
      setCreating(false)
      await load()
    } finally {
      setSavingNew(false)
    }
  }

  function openBaixa(inv: Invoice) {
    setBaixaInvoice(inv)
    setBaixaMethod('pix')
    setBaixaNote('')
  }

  async function confirmBaixa() {
    if (!baixaInvoice) return
    setSavingBaixa(true)
    try {
      const res = await fetch(`/api/invoices/${baixaInvoice.id}/baixa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: baixaMethod, note: baixaNote }),
      })
      if (res.ok) {
        setBaixaInvoice(null)
        await load()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.error || `Erro ${res.status}`)
      }
    } finally {
      setSavingBaixa(false)
    }
  }

  async function undoBaixa(inv: Invoice) {
    if (!confirm(`Reverter baixa de ${formatCurrency(inv.amount)} ?`)) return
    const res = await fetch(`/api/invoices/${inv.id}/baixa`, { method: 'DELETE' })
    if (res.ok) await load()
    else alert(`Erro ${res.status}`)
  }

  async function cancelInvoice(inv: Invoice) {
    if (!confirm(`Cancelar fatura #${inv.sequentialNumber || '?'} de ${formatCurrency(inv.amount)}?`)) return
    const res = await fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (res.ok) await load()
    else alert(d.error || `Erro ${res.status}`)
  }

  if (erpBlock) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Contas a Receber</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Esta tela só está disponível quando o ERP está configurado como <strong>Banco próprio do sistema</strong>.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Vá em <a href="/configuracoes" className="text-purple-600 hover:underline">Configurações &gt; Integração ERP</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Contas a Receber</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{total} fatura(s)</p>
        </div>
        <Button size="sm" onClick={openNewInvoice}>
          <Plus size={14} /> Nova Fatura
        </Button>
      </div>

      {/* Filtros */}
      <Card className="mb-5">
        <CardContent className="py-3 flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-gray-400" />
            <input
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400 dark:text-gray-200"
              placeholder="Buscar por nome do cliente..."
              value={filterQ}
              onChange={(e) => { setFilterQ(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          >
            <option value="">Todos status</option>
            <option value="aberta">Aberta</option>
            <option value="vencida">Vencida</option>
            <option value="paga">Paga</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nenhuma fatura encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Cliente</th>
                    <th className="px-4 py-2 text-left">Produto</th>
                    <th className="px-4 py-2 text-left">Vencimento</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                        #{inv.sequentialNumber ?? inv.id.substring(0, 6)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-800 dark:text-gray-200">{inv.client.name}</div>
                        {inv.description && <div className="text-xs text-gray-400">{inv.description}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {inv.product?.name || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant={statusBadge[inv.status] || 'muted'}>{inv.status}</Badge>
                        {inv.status === 'paga' && inv.paidVia && (
                          <div className="text-[10px] text-gray-400 mt-0.5" title={inv.paymentNote || ''}>
                            {inv.paidVia === 'manual' ? 'Baixa manual' : inv.paidVia}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {(inv.status === 'aberta' || inv.status === 'vencida') && (
                            <>
                              <button
                                onClick={() => openBaixa(inv)}
                                title="Dar baixa (marcar como paga)"
                                className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-900/30 text-green-600"
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button
                                onClick={() => cancelInvoice(inv)}
                                title="Cancelar fatura"
                                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          {inv.status === 'paga' && inv.paidVia === 'manual' && (
                            <button
                              onClick={() => undoBaixa(inv)}
                              title="Reverter baixa"
                              className="p-1.5 rounded hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-600"
                            >
                              <Undo2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-400">Página {page} de {pages}</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
                    <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal nova fatura */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreating(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nova Fatura Avulsa</h2>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <FormField label="Cliente *">
                <select className="form-ctrl" value={newInv.clientId} onChange={(e) => setNewInv({ ...newInv, clientId: e.target.value })}>
                  <option value="">— Selecione —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Produto / Serviço (opcional)">
                <select className="form-ctrl" value={newInv.productId} onChange={(e) => handleProductChange(e.target.value)}>
                  <option value="">— Sem vínculo —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.amount)}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Valor *">
                  <input className="form-ctrl" type="text" inputMode="decimal" value={newInv.amount} onChange={(e) => setNewInv({ ...newInv, amount: e.target.value })} placeholder="99,90" />
                </FormField>
                <FormField label="Vencimento *">
                  <input className="form-ctrl" type="date" value={newInv.dueDate} onChange={(e) => setNewInv({ ...newInv, dueDate: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Descrição (opcional)">
                <input className="form-ctrl" value={newInv.description} onChange={(e) => setNewInv({ ...newInv, description: e.target.value })} placeholder="Ex: Instalação, serviço extra..." />
              </FormField>
              {newError && (
                <div className="px-3 py-2 rounded text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700">
                  {newError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setCreating(false)} className="text-sm px-4 py-2 text-gray-600 dark:text-gray-400 font-medium">Cancelar</button>
              <button
                onClick={saveNew}
                disabled={savingNew || !newInv.clientId || !newInv.amount || !newInv.dueDate}
                className="inline-flex items-center gap-2 text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {savingNew ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Criar fatura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal baixa manual */}
      {baixaInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBaixaInvoice(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dar Baixa Manual</h2>
              <button onClick={() => setBaixaInvoice(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm">
                <div className="text-gray-600 dark:text-gray-400">{baixaInvoice.client.name}</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(baixaInvoice.amount)}</div>
                <div className="text-xs text-gray-400">Venc: {formatDate(baixaInvoice.dueDate)}</div>
              </div>
              <FormField label="Forma de pagamento">
                <select className="form-ctrl" value={baixaMethod} onChange={(e) => setBaixaMethod(e.target.value)}>
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência / TED</option>
                  <option value="boleto">Boleto</option>
                  <option value="cartao">Cartão</option>
                  <option value="outro">Outro</option>
                </select>
              </FormField>
              <FormField label="Observação (opcional)">
                <textarea className="form-ctrl min-h-[60px]" value={baixaNote} onChange={(e) => setBaixaNote(e.target.value)} placeholder="Ex: Pago em dinheiro na loja" />
              </FormField>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setBaixaInvoice(null)} className="text-sm px-4 py-2 text-gray-600 dark:text-gray-400 font-medium">Cancelar</button>
              <button
                onClick={confirmBaixa}
                disabled={savingBaixa}
                className="inline-flex items-center gap-2 text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {savingBaixa ? <><Loader2 size={14} className="animate-spin" /> Processando...</> : <><CheckCircle size={14} /> Confirmar baixa</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .form-ctrl {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
          color: rgb(17 24 39);
          outline: none;
        }
        .form-ctrl:focus {
          border-color: rgb(168 85 247);
          box-shadow: 0 0 0 2px rgb(168 85 247 / 0.2);
        }
        :global(.dark) .form-ctrl {
          background: rgb(55 65 81);
          border-color: rgb(75 85 99);
          color: rgb(229 231 235);
        }
      `}</style>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  )
}
