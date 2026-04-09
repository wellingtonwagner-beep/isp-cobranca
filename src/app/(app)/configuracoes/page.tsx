/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Wifi, MessageSquare, Clock, CheckCircle } from 'lucide-react'

type Tab = 'empresa' | 'erp' | 'whatsapp' | 'cobrancas'

interface Settings {
  company: { name: string; cnpj: string; email: string; logo?: string }
  settings: {
    erpType: string
    sgpBaseUrl?: string
    sgpToken?: string
    sgpApp?: string
    evolutionBaseUrl?: string
    evolutionApiKey?: string
    evolutionInstance?: string
    companyWhatsapp?: string
    companyHours?: string
    testMode: boolean
    sendWindowStart: string
    sendWindowEnd: string
    sendDays: string
  } | null
}

const TABS = [
  { id: 'empresa' as Tab, label: 'Empresa', icon: Building2 },
  { id: 'erp' as Tab, label: 'Integração ERP', icon: Wifi },
  { id: 'whatsapp' as Tab, label: 'WhatsApp', icon: MessageSquare },
  { id: 'cobrancas' as Tab, label: 'Cobranças', icon: Clock },
]

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>('empresa')
  const [data, setData] = useState<Settings | null>(null)
  const [form, setForm] = useState<Record<string, string | boolean>>({})
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/configuracoes')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setForm({
          name: d.company?.name || '',
          logo: d.company?.logo || '',
          erpType: d.settings?.erpType || 'sgp',
          sgpBaseUrl: d.settings?.sgpBaseUrl || '',
          sgpToken: d.settings?.sgpToken || '',
          sgpApp: d.settings?.sgpApp || '',
          evolutionBaseUrl: d.settings?.evolutionBaseUrl || '',
          evolutionApiKey: d.settings?.evolutionApiKey || '',
          evolutionInstance: d.settings?.evolutionInstance || '',
          companyWhatsapp: d.settings?.companyWhatsapp || '',
          companyHours: d.settings?.companyHours || 'Seg-Sex 8h às 18h | Sáb 8h às 12h',
          testMode: d.settings?.testMode ?? true,
          sendWindowStart: d.settings?.sendWindowStart || '08:00',
          sendWindowEnd: d.settings?.sendWindowEnd || '20:00',
          sendDays: d.settings?.sendDays || '1,2,3,4,5,6',
        })
        if (d.company?.logo) setLogoPreview(d.company.logo)
        setLoading(false)
      })
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setForm((f) => ({ ...f, [name]: val }))
  }

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result as string
      setLogoPreview(b64)
      setForm((f) => ({ ...f, logo: b64 }))
    }
    reader.readAsDataURL(file)
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/configuracoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Carregando...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie sua empresa e integrações</p>
        </div>
        <Button onClick={save} loading={saving} size="sm">
          {saved ? <><CheckCircle size={14} /> Salvo!</> : 'Salvar alterações'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-gray-100 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-[#1e1b4b] text-white'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <Card>
        <CardContent className="py-6 space-y-5">
          {tab === 'empresa' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Logo da empresa</label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-gray-50" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-purple-50 border-2 border-dashed border-purple-200 flex items-center justify-center text-purple-300 text-xs">
                      Logo
                    </div>
                  )}
                  <label className="cursor-pointer text-sm text-purple-700 font-medium hover:underline">
                    Alterar logo
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                  </label>
                </div>
              </div>
              <Field label="Nome da empresa" name="name" value={form.name as string} onChange={handleChange} />
              <Field label="CNPJ" name="cnpj" value={data?.company?.cnpj || ''} disabled />
              <Field label="E-mail de acesso" name="email" value={data?.company?.email || ''} disabled />
            </>
          )}

          {tab === 'erp' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sistema ERP</label>
                <select
                  name="erpType"
                  value={form.erpType as string}
                  onChange={handleChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="sgp">SGP TSMX</option>
                  <option value="manual">Importação Manual (CSV)</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
              {form.erpType === 'sgp' && (
                <>
                  <Field label="URL do SGP" name="sgpBaseUrl" value={form.sgpBaseUrl as string} onChange={handleChange} placeholder="https://suaempresa.sgp.net.br" />
                  <Field label="Token SGP" name="sgpToken" value={form.sgpToken as string} onChange={handleChange} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  <Field label="App SGP" name="sgpApp" value={form.sgpApp as string} onChange={handleChange} placeholder="isp-cobranca" />
                </>
              )}
            </>
          )}

          {tab === 'whatsapp' && (
            <>
              <Field label="URL da Evolution API" name="evolutionBaseUrl" value={form.evolutionBaseUrl as string} onChange={handleChange} placeholder="https://evolution.suaempresa.com" />
              <Field label="API Key" name="evolutionApiKey" value={form.evolutionApiKey as string} onChange={handleChange} placeholder="Chave de API" />
              <Field label="Nome da instância" name="evolutionInstance" value={form.evolutionInstance as string} onChange={handleChange} placeholder="minha-instancia" />
              <hr className="border-gray-100" />
              <Field label="WhatsApp de atendimento" name="companyWhatsapp" value={form.companyWhatsapp as string} onChange={handleChange} placeholder="(37) 99999-9999" />
              <Field label="Horário de atendimento" name="companyHours" value={form.companyHours as string} onChange={handleChange} placeholder="Seg-Sex 8h às 18h | Sáb 8h às 12h" />
            </>
          )}

          {tab === 'cobrancas' && (
            <>
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
                <div>
                  <p className="font-medium text-amber-800 text-sm">Modo Teste</p>
                  <p className="text-xs text-amber-600 mt-0.5">Quando ativo, mensagens são bloqueadas e apenas logadas</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="testMode"
                    checked={form.testMode as boolean}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Início da janela" name="sendWindowStart" value={form.sendWindowStart as string} onChange={handleChange} type="time" />
                <Field label="Fim da janela" name="sendWindowEnd" value={form.sendWindowEnd as string} onChange={handleChange} type="time" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dias de envio</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { v: '0', l: 'Dom' }, { v: '1', l: 'Seg' }, { v: '2', l: 'Ter' },
                    { v: '3', l: 'Qua' }, { v: '4', l: 'Qui' }, { v: '5', l: 'Sex' }, { v: '6', l: 'Sáb' },
                  ].map(({ v, l }) => {
                    const days = (form.sendDays as string).split(',')
                    const active = days.includes(v)
                    return (
                      <button
                        key={v}
                        onClick={() => {
                          const next = active ? days.filter((d) => d !== v) : [...days, v]
                          setForm((f) => ({ ...f, sendDays: next.sort().join(',') }))
                        }}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                          active ? 'bg-[#1e1b4b] text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({
  label, name, value, onChange, placeholder, disabled, type = 'text',
}: {
  label: string
  name: string
  value: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  disabled?: boolean
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  )
}
