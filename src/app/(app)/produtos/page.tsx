'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, Plus, Edit2, Trash2, X, Loader2 } from 'lucide-react'

interface Product {
  id: string
  name: string
  description: string | null
  amount: number
  recurrence: 'once' | 'monthly' | 'yearly'
  active: boolean
  _count: { invoices: number; subscriptions: number }
}

const RECURRENCE_LABEL: Record<string, string> = {
  once: 'Avulso',
  monthly: 'Mensal',
  yearly: 'Anual',
}

const RECURRENCE_VARIANT: Record<string, 'muted' | 'success' | 'info'> = {
  once: 'muted',
  monthly: 'success',
  yearly: 'info',
}

function formatCurrency(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface FormState {
  name: string
  description: string
  amount: string
  recurrence: 'once' | 'monthly' | 'yearly'
  active: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  amount: '',
  recurrence: 'once',
  active: true,
}

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(true)
  const [erpBlock, setErpBlock] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/produtos?includeInactive=${includeInactive ? 1 : 0}`)
      if (res.ok) {
        const data = await res.json()
        setProducts(data.products || [])
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

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setCreating(true)
    setFormError(null)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description || '',
      amount: String(p.amount),
      recurrence: p.recurrence,
      active: p.active,
    })
    setCreating(true)
    setFormError(null)
  }

  function closeModal() {
    setCreating(false)
    setEditing(null)
    setFormError(null)
  }

  async function save() {
    setSaving(true)
    setFormError(null)
    try {
      const url = editing ? `/api/produtos/${editing.id}` : '/api/produtos'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          amount: parseFloat(form.amount.replace(',', '.')),
          recurrence: form.recurrence,
          active: form.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError(data.error || `Erro ${res.status}`)
        return
      }
      closeModal()
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Remover o produto "${p.name}"?`)) return
    const res = await fetch(`/api/produtos/${p.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error || `Erro ${res.status}`)
      return
    }
    await load()
  }

  if (erpBlock) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Produtos / Serviços</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Esta tela só está disponível quando o ERP está configurado como
              <strong> Banco próprio do sistema</strong>.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Vá em <a href="/configuracoes" className="text-purple-600 hover:underline">Configurações &gt; Integração ERP</a> para ajustar.
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Produtos / Serviços</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {products.length} item(ns) cadastrado(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded"
            />
            Incluir inativos
          </label>
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> Novo Produto
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !products.length ? (
            <div className="py-12 text-center">
              <Package className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nenhum produto cadastrado.</p>
            </div>
          ) : (() => {
            const total = products.length
            const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
            const safePage = Math.min(page, pages)
            const paginated = products.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
            return (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-4 py-2 text-left">Nome</th>
                    <th className="px-4 py-2 text-left">Recorrência</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2 text-center">Faturas</th>
                    <th className="px-4 py-2 text-center">Assinaturas</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-800 dark:text-gray-200">{p.name}</div>
                        {p.description && <div className="text-xs text-gray-400">{p.description}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={RECURRENCE_VARIANT[p.recurrence]}>{RECURRENCE_LABEL[p.recurrence]}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300 font-semibold whitespace-nowrap">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{p._count.invoices}</td>
                      <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{p._count.subscriptions}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant={p.active ? 'success' : 'muted'}>{p.active ? 'Ativo' : 'Inativo'}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            title="Editar"
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => remove(p)}
                            title="Excluir"
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500"
                          >
                            <Trash2 size={14} />
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
                <span className="text-xs text-gray-400">Página {safePage} de {pages} · {total} item(ns)</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editing ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <ModalField label="Nome *">
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Plano 200MB Residencial"
                  autoFocus
                />
              </ModalField>

              <ModalField label="Descrição">
                <textarea
                  className="form-input min-h-[60px]"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detalhes opcionais"
                />
              </ModalField>

              <div className="grid grid-cols-2 gap-3">
                <ModalField label="Valor (R$) *">
                  <input
                    className="form-input"
                    type="text"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="99,90"
                  />
                </ModalField>
                <ModalField label="Recorrência *">
                  <select
                    className="form-input"
                    value={form.recurrence}
                    onChange={(e) => setForm({ ...form, recurrence: e.target.value as FormState['recurrence'] })}
                  >
                    <option value="once">Avulso</option>
                    <option value="monthly">Mensalidade</option>
                    <option value="yearly">Anual</option>
                  </select>
                </ModalField>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded"
                />
                Produto ativo
              </label>

              {formError && (
                <div className="px-3 py-2 rounded text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={closeModal}
                className="text-sm px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim() || !form.amount}
                className="inline-flex items-center gap-2 text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .form-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
          color: rgb(17 24 39);
          outline: none;
        }
        .form-input:focus {
          border-color: rgb(168 85 247);
          box-shadow: 0 0 0 2px rgb(168 85 247 / 0.2);
        }
        :global(.dark) .form-input {
          background: rgb(55 65 81);
          border-color: rgb(75 85 99);
          color: rgb(229 231 235);
        }
      `}</style>
    </div>
  )
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  )
}
