'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Repeat, Plus, Edit2, Power, X, Loader2 } from 'lucide-react'

interface Subscription {
  id: string
  clientId: string
  productId: string
  dayOfMonth: number
  startDate: string
  endDate: string | null
  active: boolean
  lastGeneratedAt: string | null
  client: { id: string; name: string; whatsapp: string | null }
  product: { id: string; name: string; amount: number; recurrence: string }
  _count: { invoices: number }
}

interface ClientOption { id: string; name: string }
interface ProductOption { id: string; name: string; amount: number; recurrence: string }

function formatCurrency(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function formatMonthYear(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface FormState {
  clientId: string
  productId: string
  dayOfMonth: string
  startDate: string
  endDate: string
  active: boolean
}

const EMPTY_FORM: FormState = {
  clientId: '', productId: '', dayOfMonth: '10', startDate: todayStr(), endDate: '', active: true,
}

export default function AssinaturasPage() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(true)
  const [erpBlock, setErpBlock] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const [clients, setClients] = useState<ClientOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/subscriptions?includeInactive=${includeInactive ? 1 : 0}`)
      if (res.ok) {
        const data = await res.json()
        setSubs(data.subscriptions || [])
      }
    } finally {
      setLoading(false)
    }
  }, [includeInactive])

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      if (d.user?.erpType !== 'manual') setErpBlock(true)
    })
    load()
  }, [load])

  async function openCreate() {
    const [cRes, pRes] = await Promise.all([
      fetch('/api/clientes?limit=500'),
      fetch('/api/produtos'),
    ])
    const cData = await cRes.json()
    const pData = await pRes.json()
    setClients((cData.clients || []).map((c: ClientOption) => ({ id: c.id, name: c.name })))
    // Filtra apenas produtos recorrentes (monthly/yearly)
    setProducts((pData.products || []).filter((p: ProductOption) => p.recurrence !== 'once'))
    setEditing(null)
    setForm(EMPTY_FORM)
    setCreating(true)
    setFormError(null)
  }

  async function openEdit(s: Subscription) {
    const [cRes, pRes] = await Promise.all([
      fetch('/api/clientes?limit=500'),
      fetch('/api/produtos'),
    ])
    const cData = await cRes.json()
    const pData = await pRes.json()
    setClients((cData.clients || []).map((c: ClientOption) => ({ id: c.id, name: c.name })))
    setProducts((pData.products || []).filter((p: ProductOption) => p.recurrence !== 'once'))
    setEditing(s)
    setForm({
      clientId: s.clientId,
      productId: s.productId,
      dayOfMonth: String(s.dayOfMonth),
      startDate: s.startDate.substring(0, 10),
      endDate: s.endDate ? s.endDate.substring(0, 10) : '',
      active: s.active,
    })
    setCreating(true)
    setFormError(null)
  }

  async function save() {
    setSaving(true)
    setFormError(null)
    try {
      const url = editing ? `/api/subscriptions/${editing.id}` : '/api/subscriptions'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? {} : { clientId: form.clientId, productId: form.productId }),
          dayOfMonth: form.dayOfMonth,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          active: form.active,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFormError(d.error || `Erro ${res.status}`); return }
      setCreating(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(s: Subscription) {
    const action = s.active ? 'desativar' : 'ativar'
    if (!confirm(`Deseja ${action} a assinatura de ${s.client.name}?`)) return
    const res = s.active
      ? await fetch(`/api/subscriptions/${s.id}`, { method: 'DELETE' })
      : await fetch(`/api/subscriptions/${s.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: true }),
        })
    if (res.ok) await load()
    else alert(`Erro ${res.status}`)
  }

  if (erpBlock) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardContent className="py-12 text-center">
            <Repeat className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Assinaturas / Mensalidades</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Esta tela só está disponível no modo <strong>Banco próprio do sistema</strong>.
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Assinaturas</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {subs.length} assinatura(s) · faturas geradas automaticamente no dia configurado
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 flex items-center gap-1.5">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="rounded" />
            Incluir inativas
          </label>
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> Nova Assinatura
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !subs.length ? (
            <div className="py-12 text-center">
              <Repeat className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nenhuma assinatura cadastrada.</p>
            </div>
          ) : (() => {
            const total = subs.length
            const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
            const safePage = Math.min(page, pages)
            const paginated = subs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
            return (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-4 py-2 text-left">Cliente</th>
                    <th className="px-4 py-2 text-left">Produto</th>
                    <th className="px-4 py-2 text-center">Dia</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2 text-left">Vigência</th>
                    <th className="px-4 py-2 text-center">Último ciclo</th>
                    <th className="px-4 py-2 text-center">Faturas</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{s.client.name}</td>
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{s.product.name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold">
                          {s.dayOfMonth}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatCurrency(s.product.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {formatDate(s.startDate)}
                        {s.endDate && <> → {formatDate(s.endDate)}</>}
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs text-gray-500">{formatMonthYear(s.lastGeneratedAt)}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-gray-500">{s._count.invoices}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant={s.active ? 'success' : 'muted'}>{s.active ? 'Ativa' : 'Inativa'}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <button onClick={() => openEdit(s)} title="Editar" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => toggleActive(s)}
                            title={s.active ? 'Desativar' : 'Ativar'}
                            className={`p-1.5 rounded ${s.active ? 'hover:bg-red-50 text-red-500 dark:hover:bg-red-900/30' : 'hover:bg-green-50 text-green-500 dark:hover:bg-green-900/30'}`}
                          >
                            <Power size={14} />
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
                <span className="text-xs text-gray-400">Página {safePage} de {pages} · {total} assinatura(s)</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Anterior</Button>
                  <Button variant="secondary" size="sm" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>Próxima</Button>
                </div>
              </div>
            )}
            </>
            )
          })()}
        </CardContent>
      </Card>

      {/* Modal Criar/Editar */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreating(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editing ? 'Editar Assinatura' : 'Nova Assinatura'}</h2>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {!editing && (
                <>
                  <F label="Cliente *">
                    <select className="fctrl" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                      <option value="">— Selecione —</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </F>
                  <F label="Produto recorrente *">
                    <select className="fctrl" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                      <option value="">— Selecione —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(p.amount)} / {p.recurrence === 'monthly' ? 'mês' : 'ano'}
                        </option>
                      ))}
                    </select>
                    {products.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Nenhum produto recorrente cadastrado. Crie primeiro em <a href="/produtos" className="underline">Produtos</a>.
                      </p>
                    )}
                  </F>
                </>
              )}
              {editing && (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm">
                  <div className="font-medium text-gray-800 dark:text-gray-200">{editing.client.name}</div>
                  <div className="text-xs text-gray-500">{editing.product.name} — {formatCurrency(editing.product.amount)}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <F label="Dia do vencimento *">
                  <input
                    className="fctrl"
                    type="number"
                    min={1}
                    max={31}
                    value={form.dayOfMonth}
                    onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
                  />
                </F>
                <F label="Início *">
                  <input className="fctrl" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </F>
              </div>
              <F label="Término (opcional)">
                <input className="fctrl" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </F>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded" />
                Assinatura ativa (gera faturas mensalmente)
              </label>
              <p className="text-xs text-gray-400">
                Dias 29-31 em meses menores são gerados no último dia do mês.
              </p>
              {formError && (
                <div className="px-3 py-2 rounded text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700">
                  {formError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setCreating(false)} className="text-sm px-4 py-2 text-gray-600 dark:text-gray-400 font-medium">Cancelar</button>
              <button
                onClick={save}
                disabled={saving || (!editing && (!form.clientId || !form.productId)) || !form.dayOfMonth || !form.startDate}
                className="inline-flex items-center gap-2 text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .fctrl {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
          color: rgb(17 24 39);
          outline: none;
        }
        .fctrl:focus {
          border-color: rgb(168 85 247);
          box-shadow: 0 0 0 2px rgb(168 85 247 / 0.2);
        }
        :global(.dark) .fctrl {
          background: rgb(55 65 81);
          border-color: rgb(75 85 99);
          color: rgb(229 231 235);
        }
      `}</style>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  )
}
