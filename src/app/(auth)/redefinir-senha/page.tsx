'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PasswordInput } from '@/components/ui/password-input'

function RedefinirContent() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setMsg({ ok: false, text: 'As senhas não conferem.' })
      return
    }
    if (password.length < 6) {
      setMsg({ ok: false, text: 'A senha precisa ter ao menos 6 caracteres.' })
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      setMsg({ ok: !!data.ok, text: data.message || data.error || 'Erro inesperado.' })
      if (data.ok) setTimeout(() => router.push('/login'), 2000)
    } catch {
      setMsg({ ok: false, text: 'Erro de conexão.' })
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h1>
          <p className="text-sm text-gray-600 mb-4">Token de redefinição não encontrado na URL.</p>
          <Link href="/esqueci-senha" className="text-purple-700 font-medium hover:underline text-sm">
            Solicitar novo link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="text-3xl font-bold text-white tracking-wide">
          <span className="text-purple-300">ISP</span>
          <span className="text-white ml-1">Cobrança</span>
        </div>
        <p className="text-purple-300 text-sm mt-2">Definir nova senha</p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Nova senha</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Repita a senha"
            />
          </div>

          {msg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !!msg?.ok}
            className="w-full bg-[#1e1b4b] hover:bg-[#312e81] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {loading ? 'Salvando...' : 'Definir nova senha'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/login" className="text-purple-700 font-medium hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<div className="text-white text-sm">Carregando...</div>}>
      <RedefinirContent />
    </Suspense>
  )
}
