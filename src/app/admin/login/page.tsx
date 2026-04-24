'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, AlertTriangle } from 'lucide-react'
import { PasswordInput } from '@/components/ui/password-input'

export default function AdminLoginPage() {
  const router = useRouter()
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/admin-auth/setup')
      .then((r) => r.json())
      .then((d) => setNeedsSetup(!!d.needsSetup))
      .catch(() => setNeedsSetup(false))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Credenciais inválidas.'); return }
      router.push('/admin/empresas')
      router.refresh()
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('As senhas não conferem.'); return }
    if (password.length < 8) { setError('A senha deve ter no mínimo 8 caracteres.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin-auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao criar admin.'); return }
      // Faz login automaticamente apos criar
      const login = await fetch('/api/admin-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (login.ok) {
        router.push('/admin/empresas')
        router.refresh()
      }
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  if (needsSetup === null) {
    return <div className="text-amber-200 text-sm">Carregando...</div>
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-600 mb-3">
          <Shield size={28} className="text-white" />
        </div>
        <div className="text-2xl font-bold text-white">Admin Sistema</div>
        <p className="text-amber-300 text-sm mt-1">Acesso restrito ao super administrador</p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-8">
        {needsSetup ? (
          <>
            <div className="flex items-start gap-2 p-3 mb-5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>Primeiro acesso.</strong><br />
                Nenhum super administrador cadastrado ainda. Crie o primeiro agora.
                Após criado, este formulário fica bloqueado.
              </div>
            </div>
            <form onSubmit={handleSetup} className="space-y-4">
              <LoginField label="Nome" value={name} onChange={setName} placeholder="Seu nome" required />
              <LoginField label="E-mail" value={email} onChange={setEmail} placeholder="admin@sistema.com" type="email" required />
              <LoginField label="Senha (mín. 8 caracteres)" value={password} onChange={setPassword} type="password" required />
              <LoginField label="Confirmar senha" value={confirm} onChange={setConfirm} type="password" required />
              {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {loading ? 'Criando...' : 'Criar super administrador'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-6">Entrar como Admin</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <LoginField label="E-mail" value={email} onChange={setEmail} placeholder="admin@sistema.com" type="email" required />
              <LoginField label="Senha" value={password} onChange={setPassword} type="password" required />
              {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
            <p className="text-center text-xs text-gray-400 mt-6">
              <a href="/login" className="hover:underline">Voltar ao login de empresas</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function LoginField({
  label, value, onChange, placeholder, type, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  const className = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500'
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {type === 'password' ? (
        <PasswordInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className={className}
        />
      ) : (
        <input
          type={type || 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className={className}
        />
      )}
    </div>
  )
}
