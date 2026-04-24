'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      setMsg({
        ok: !!data.ok,
        text: data.message || data.error || 'Erro inesperado.',
      })
    } catch {
      setMsg({ ok: false, text: 'Erro de conexão.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="text-3xl font-bold text-white tracking-wide">
          <span className="text-purple-300">ISP</span>
          <span className="text-white ml-1">Cobrança</span>
        </div>
        <p className="text-purple-300 text-sm mt-2">Recuperação de senha</p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Esqueci minha senha</h1>
        <p className="text-sm text-gray-600 mb-6">
          Informe o e-mail cadastrado da empresa. Vamos gerar um link de redefinição.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="empresa@email.com"
            />
          </div>

          {msg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1e1b4b] hover:bg-[#312e81] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {loading ? 'Enviando...' : 'Enviar link de redefinição'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Lembrou?{' '}
          <Link href="/login" className="text-purple-700 font-medium hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  )
}
