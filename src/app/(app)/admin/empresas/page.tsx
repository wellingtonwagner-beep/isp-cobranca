'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, RefreshCw } from 'lucide-react'
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
