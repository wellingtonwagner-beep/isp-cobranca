'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, RefreshCw, Eraser, X, AlertTriangle, Loader2 } from 'lucide-react'
import { PLAN_LABELS, type Plan } from '@/lib/plans'
import { formatDateBR } from '@/lib/utils'

interface Company {
  id: string
  name: string
  cnpj: string
  email: string
  plan: Plan
  active: boolean
  createdAt: string
  _count: { clients: number; invoices: number; messageLogs: number }
}

const PLAN_OPTIONS: Plan[] = ['lite', 'premium', 'elite']

export default function AdminEmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  // Modal de wipe
  const [wipeTarget, setWipeTarget] = useState<Company | null>(null)
  const [wipeConfirm, setWipeConfirm] = useState('')
  const [wiping, setWiping] = useState(false)
  const [wipeResult, setWipeResult] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/empresas')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Erro ${res.status}`)
        setCompanies([])
        return
      }
      const data = await res.json()
      setCompanies(data.companies || [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function changePlan(id: string, plan: Plan) {
    setUpdating(id)
    try {
      const res = await fetch('/api/admin/empresas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, plan }),
      })
      if (res.ok) {
        setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, plan } : c))
      }
    } finally {
      setUpdating(null)
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setUpdating(id)
    try {
      const res = await fetch('/api/admin/empresas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active }),
      })
      if (res.ok) {
        setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, active } : c))
      }
    } finally {
      setUpdating(null)
    }
  }

  function openWipe(c: Company) {
    setWipeTarget(c)
    setWipeConfirm('')
    setWipeResult(null)
  }

  function closeWipe() {
    setWipeTarget(null)
    setWipeConfirm('')
  }

  async function executeWipe() {
    if (!wipeTarget) return
    setWiping(true)
    setWipeResult(null)
    try {
      const res = await fetch(`/api/admin/empresas/${wipeTarget.id}/wipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: wipeConfirm }),
      })
      const data = await res.json().catch(() => ({}))
      setWipeResult({ ok: !!data.ok, text: data.message || data.error || `Erro ${res.status}` })
      if (data.ok) await load()
    } catch (err) {
      setWipeResult({ ok: false, text: String(err) })
    } finally {
      setWiping(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin — Empresas</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gerencie planos e status das empresas cadastradas
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
            <p className="text-sm text-gray-500 mt-2">
              Esta página é restrita ao super-admin (defina <code>SUPER_ADMIN_EMAIL</code> no ambiente).
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : companies.length === 0 && !error ? (
            <div className="py-12 text-center text-gray-400 text-sm">Nenhuma empresa cadastrada.</div>
          ) : companies.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-4 py-2 text-left">Empresa</th>
                    <th className="px-4 py-2 text-left">CNPJ</th>
                    <th className="px-4 py-2 text-left">Cadastro</th>
                    <th className="px-4 py-2 text-center">Clientes</th>
                    <th className="px-4 py-2 text-center">Faturas</th>
                    <th className="px-4 py-2 text-center">Mensagens</th>
                    <th className="px-4 py-2 text-left">Plano</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 dark:border-gray-700/50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-800 dark:text-gray-200">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.email}</div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{c.cnpj}</td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{formatDateBR(c.createdAt)}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700 dark:text-gray-300">{c._count.clients}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700 dark:text-gray-300">{c._count.invoices}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700 dark:text-gray-300">{c._count.messageLogs}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={c.plan}
                          onChange={(e) => changePlan(c.id, e.target.value as Plan)}
                          disabled={updating === c.id}
                          className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        >
                          {PLAN_OPTIONS.map((p) => (
                            <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => toggleActive(c.id, !c.active)}
                          disabled={updating === c.id}
                        >
                          <Badge variant={c.active ? 'success' : 'muted'}>
                            {c.active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => openWipe(c)}
                          title="Apagar todos os dados operacionais (clientes, faturas, mensagens, etc.)"
                          className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded"
                        >
                          <Eraser size={12} /> Limpar dados
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Modal de wipe */}
      {wipeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !wiping && closeWipe()}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Limpar dados da empresa</h2>
              </div>
              <button onClick={closeWipe} disabled={wiping} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-sm text-red-800 dark:text-red-300">
                <strong>Atenção:</strong> esta ação apaga <strong>todos os dados operacionais</strong> da empresa
                <strong> &quot;{wipeTarget.name}&quot;</strong>:
                clientes, faturas, mensagens, produtos, assinaturas, feriados e configurações extras.
                A empresa e suas credenciais (CNPJ, e-mail, ERP, WhatsApp, PIX) serão preservadas.
                <br /><br />
                <strong>Não é possível desfazer.</strong>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Atualmente: <strong>{wipeTarget._count.clients}</strong> clientes, <strong>{wipeTarget._count.invoices}</strong> faturas, <strong>{wipeTarget._count.messageLogs}</strong> mensagens.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Para confirmar, digite o nome exato da empresa:
                </label>
                <div className="text-xs text-gray-500 mb-1 font-mono">{wipeTarget.name}</div>
                <input
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                  value={wipeConfirm}
                  onChange={(e) => setWipeConfirm(e.target.value)}
                  placeholder="Digite o nome..."
                  autoFocus
                />
              </div>
              {wipeResult && (
                <div className={`px-3 py-2 rounded text-sm ${wipeResult.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                  {wipeResult.text}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              {wipeResult?.ok ? (
                <button
                  onClick={closeWipe}
                  className="inline-flex items-center gap-2 text-sm bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700"
                >
                  Fechar
                </button>
              ) : (
                <>
                  <button onClick={closeWipe} disabled={wiping} className="text-sm px-4 py-2 text-gray-600 dark:text-gray-400 font-medium">Cancelar</button>
                  <button
                    onClick={executeWipe}
                    disabled={wiping || wipeConfirm !== wipeTarget.name}
                    className="inline-flex items-center gap-2 text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {wiping ? <><Loader2 size={14} className="animate-spin" /> Apagando...</> : <><Eraser size={14} /> Apagar dados</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
