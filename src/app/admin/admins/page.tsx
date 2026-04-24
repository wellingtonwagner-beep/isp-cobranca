'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Plus, X, Loader2, Power, KeyRound, Trash2 } from 'lucide-react'
import { formatDateBR } from '@/lib/utils'
import { PasswordInput } from '@/components/ui/password-input'

interface AdminUser {
  id: string
  email: string
  name: string
  active: boolean
  lastLoginAt: string | null
  createdAt: string
}

interface Me { id: string; email: string }

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  // Modais
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<AdminUser | null>(null)

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [newPwd, setNewPwd] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, meRes] = await Promise.all([
        fetch('/api/admin/admins'),
        fetch('/api/admin-auth/me'),
      ])
      if (listRes.ok) setAdmins((await listRes.json()).admins || [])
      if (meRes.ok) setMe((await meRes.json()).admin)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive(a: AdminUser) {
    const res = await fetch(`/api/admin/admins/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !a.active }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) alert(d.error || `Erro ${res.status}`)
    else await load()
  }

  async function removeAdmin(a: AdminUser) {
    if (!confirm(`Excluir o administrador "${a.name}" (${a.email})?`)) return
    const res = await fetch(`/api/admin/admins/${a.id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) alert(d.error || `Erro ${res.status}`)
    else await load()
  }

  async function createAdmin() {
    setSaving(true); setFormError(null)
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFormError(d.error || `Erro ${res.status}`); return }
      setCreating(false)
      setForm({ name: '', email: '', password: '' })
      await load()
    } finally { setSaving(false) }
  }

  async function resetPassword() {
    if (!resetting) return
    setSaving(true); setFormError(null)
    try {
      const res = await fetch(`/api/admin/admins/${resetting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPwd }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFormError(d.error || `Erro ${res.status}`); return }
      setResetting(null); setNewPwd('')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Administradores do Sistema</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Usuários com acesso ao painel de admin (gerenciam todas as empresas)
          </p>
        </div>
        <Button size="sm" onClick={() => { setCreating(true); setFormError(null) }}>
          <Plus size={14} /> Novo Administrador
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !admins.length ? (
            <div className="py-12 text-center text-gray-400 text-sm">Nenhum admin cadastrado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left">Nome</th>
                  <th className="px-4 py-2 text-left">E-mail</th>
                  <th className="px-4 py-2 text-left">Último login</th>
                  <th className="px-4 py-2 text-left">Cadastro</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50 dark:border-gray-700/50">
                    <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">
                      {a.name}
                      {me?.id === a.id && <span className="ml-2 text-xs text-amber-600">(você)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{a.email}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{a.lastLoginAt ? formatDateBR(a.lastLoginAt) : '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{formatDateBR(a.createdAt)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={a.active ? 'success' : 'muted'}>{a.active ? 'Ativo' : 'Inativo'}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => { setResetting(a); setNewPwd(''); setFormError(null) }}
                          title="Redefinir senha"
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                        >
                          <KeyRound size={14} />
                        </button>
                        {me?.id !== a.id && (
                          <>
                            <button
                              onClick={() => toggleActive(a)}
                              title={a.active ? 'Desativar' : 'Ativar'}
                              className={`p-1.5 rounded ${a.active ? 'hover:bg-red-50 text-red-500' : 'hover:bg-green-50 text-green-500'}`}
                            >
                              <Power size={14} />
                            </button>
                            <button
                              onClick={() => removeAdmin(a)}
                              title="Excluir"
                              className="p-1.5 rounded hover:bg-red-50 text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <Modal onClose={() => setCreating(false)} title="Novo Administrador">
          <Field label="Nome"><input className="adm-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="E-mail"><input type="email" className="adm-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Senha (min 8 caracteres)"><PasswordInput className="adm-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          {formError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{formError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCreating(false)} className="text-sm px-4 py-2 text-gray-600 font-medium">Cancelar</button>
            <button
              onClick={createAdmin}
              disabled={saving || !form.name.trim() || !form.email.trim() || form.password.length < 8}
              className="inline-flex items-center gap-2 text-sm bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Criando...</> : 'Criar'}
            </button>
          </div>
        </Modal>
      )}

      {resetting && (
        <Modal onClose={() => setResetting(null)} title={`Redefinir senha de ${resetting.name}`}>
          <Field label="Nova senha (min 8 caracteres)">
            <PasswordInput className="adm-input" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoFocus />
          </Field>
          {formError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{formError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setResetting(null)} className="text-sm px-4 py-2 text-gray-600 font-medium">Cancelar</button>
            <button
              onClick={resetPassword}
              disabled={saving || newPwd.length < 8}
              className="inline-flex items-center gap-2 text-sm bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Redefinir'}
            </button>
          </div>
        </Modal>
      )}

      <style jsx global>{`
        .adm-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
          color: rgb(17 24 39);
          outline: none;
        }
        .adm-input:focus {
          border-color: rgb(217 119 6);
          box-shadow: 0 0 0 2px rgb(217 119 6 / 0.2);
        }
        .dark .adm-input {
          background: rgb(55 65 81);
          border-color: rgb(75 85 99);
          color: rgb(229 231 235);
        }
      `}</style>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  )
}
