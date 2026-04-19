/* eslint-disable @next/next/no-img-element */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function formatCNPJ(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    cnpj: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    if (name === 'cnpj') {
      setForm((f) => ({ ...f, cnpj: formatCNPJ(value) }))
    } else {
      setForm((f) => ({ ...f, [name]: value }))
    }
  }

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogo(file)
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (form.password.length < 8) {
      setError('A senha deve ter ao menos 8 caracteres.')
      return
    }

    setLoading(true)

    try {
      // Converte logo para base64 se informada
      let logoBase64: string | null = null
      if (logo) {
        logoBase64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(logo)
        })
      }

      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          cnpj: form.cnpj.replace(/\D/g, ''),
          email: form.email,
          password: form.password,
          logo: logoBase64,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta.')
      } else {
        router.push('/login?registered=1')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="text-3xl font-bold text-white tracking-wide">
          <span className="text-purple-300">ISP</span>
          <span className="text-white ml-1">Cobrança</span>
        </div>
        <p className="text-purple-300 text-sm mt-2">Cadastre sua empresa e comece agora</p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Criar conta</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo da empresa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo da empresa</label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-14 h-14 rounded-xl object-contain border border-gray-200" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-purple-50 border-2 border-dashed border-purple-200 flex items-center justify-center text-purple-300 text-xs text-center">
                  Logo
                </div>
              )}
              <label className="cursor-pointer text-sm text-purple-700 font-medium hover:underline">
                Escolher arquivo
                <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa *</label>
            <input
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Ultra Net Telecom"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ *</label>
            <input
              name="cnpj"
              type="text"
              value={form.cnpj}
              onChange={handleChange}
              required
              inputMode="numeric"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail de acesso *</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="contato@suaempresa.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="mín. 8 chars"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar *</label>
              <input
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1e1b4b] hover:bg-[#312e81] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Já tem conta?{' '}
          <Link href="/login" className="text-purple-700 font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
