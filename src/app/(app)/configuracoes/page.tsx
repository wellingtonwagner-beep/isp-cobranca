/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Wifi, MessageSquare, Clock, CheckCircle, Loader2, QrCode, RefreshCw, Send, Banknote } from 'lucide-react'

type Tab = 'empresa' | 'erp' | 'whatsapp' | 'cobrancas' | 'pix'

const PSP_OPTIONS = [
  { id: '', label: '— Selecione —' },
  { id: 'c6', label: 'C6 Bank' },
  { id: 'sicoob', label: 'Sicoob' },
  { id: 'asaas', label: 'Asaas' },
  { id: 'mercadopago', label: 'Mercado Pago' },
  { id: 'gerencianet', label: 'Gerencianet / Efí' },
  { id: 'sicredi', label: 'Sicredi' },
  { id: 'bb', label: 'Banco do Brasil' },
  { id: 'bradesco', label: 'Bradesco' },
  { id: 'itau', label: 'Itaú' },
  { id: 'inter', label: 'Inter' },
  { id: 'outro', label: 'Outro' },
]

// Adapters atualmente implementados (com createCharge real). Outros sao
// apenas placeholders no select ate ter implementacao.
const PSP_IMPLEMENTED = new Set(['c6'])

interface Settings {
  company: { name: string; cnpj: string; email: string; logo?: string }
  settings: {
    erpType: string
    sgpBaseUrl?: string
    sgpToken?: string
    sgpApp?: string
    hubsoftBaseUrl?: string
    hubsoftClientId?: string
    hubsoftClientSecret?: string
    hubsoftUsername?: string
    hubsoftPassword?: string
    evolutionBaseUrl?: string
    evolutionApiKey?: string
    evolutionInstance?: string
    companyWhatsapp?: string
    companyHours?: string
    testMode: boolean
    sendWindowStart: string
    sendWindowEnd: string
    sendDays: string
    pixPsp?: string
    pixPspApiKey?: string
    pixPspClientId?: string
    pixPspClientSecret?: string
    pixPspWebhookSecret?: string
    pixPspBaseUrl?: string
    pixPspEnv?: string
    pixPspCertBase64?: string
    pixPspCertPassword?: string
    pixKeyType?: string
    pixKeyValue?: string
    pixBeneficiaryName?: string
    pixBeneficiaryCity?: string
  } | null
}

const TABS = [
  { id: 'empresa' as Tab, label: 'Empresa', icon: Building2 },
  { id: 'erp' as Tab, label: 'Integração ERP', icon: Wifi },
  { id: 'whatsapp' as Tab, label: 'WhatsApp', icon: MessageSquare },
  { id: 'pix' as Tab, label: 'PIX', icon: Banknote },
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
  const [testingErp, setTestingErp] = useState(false)
  const [erpStatus, setErpStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [testingWpp, setTestingWpp] = useState(false)
  const [wppStatus, setWppStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testingPsp, setTestingPsp] = useState(false)
  const [pspStatus, setPspStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [certFileName, setCertFileName] = useState<string | null>(null)

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
          hubsoftBaseUrl: d.settings?.hubsoftBaseUrl || '',
          hubsoftClientId: d.settings?.hubsoftClientId || '',
          hubsoftClientSecret: d.settings?.hubsoftClientSecret || '',
          hubsoftUsername: d.settings?.hubsoftUsername || '',
          hubsoftPassword: d.settings?.hubsoftPassword || '',
          evolutionBaseUrl: d.settings?.evolutionBaseUrl || '',
          evolutionApiKey: d.settings?.evolutionApiKey || '',
          evolutionInstance: d.settings?.evolutionInstance || '',
          companyWhatsapp: d.settings?.companyWhatsapp || '',
          companyHours: d.settings?.companyHours || 'Seg-Sex 8h às 18h | Sáb 8h às 12h',
          testMode: d.settings?.testMode ?? true,
          sendWindowStart: d.settings?.sendWindowStart || '08:00',
          sendWindowEnd: d.settings?.sendWindowEnd || '20:00',
          sendDays: d.settings?.sendDays || '1,2,3,4,5,6',
          pixPsp: d.settings?.pixPsp || '',
          pixPspApiKey: d.settings?.pixPspApiKey || '',
          pixPspClientId: d.settings?.pixPspClientId || '',
          pixPspClientSecret: d.settings?.pixPspClientSecret || '',
          pixPspWebhookSecret: d.settings?.pixPspWebhookSecret || '',
          pixPspBaseUrl: d.settings?.pixPspBaseUrl || '',
          pixPspEnv: d.settings?.pixPspEnv || 'sandbox',
          pixPspCertBase64: d.settings?.pixPspCertBase64 || '',
          pixPspCertPassword: d.settings?.pixPspCertPassword || '',
          pixKeyType: d.settings?.pixKeyType || '',
          pixKeyValue: d.settings?.pixKeyValue || '',
          pixBeneficiaryName: d.settings?.pixBeneficiaryName || '',
          pixBeneficiaryCity: d.settings?.pixBeneficiaryCity || '',
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

  async function testErpConnection() {
    setTestingErp(true)
    setErpStatus(null)
    await fetch('/api/configuracoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    try {
      const res = await fetch('/api/admin/test-erp')
      const d = await res.json()
      setErpStatus({ ok: d.ok, message: d.message || d.error || 'Erro desconhecido' })
    } catch {
      setErpStatus({ ok: false, message: 'Erro ao conectar com a API.' })
    }
    setTestingErp(false)
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

  async function testWhatsapp() {
    setTestingWpp(true)
    setWppStatus(null)
    setQrCode(null)
    setQrError(null)
    await fetch('/api/configuracoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const res = await fetch('/api/admin/test-whatsapp')
    const d = await res.json()
    setWppStatus({ ok: d.ok, message: d.message || d.error || 'Erro desconhecido' })
    setTestingWpp(false)
  }

  async function generateQrCode() {
    setLoadingQr(true)
    setQrError(null)
    setQrCode(null)
    await fetch('/api/configuracoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    try {
      const res = await fetch('/api/qr')
      const d = await res.json()
      if (d.base64) {
        setQrCode(d.base64)
      } else {
        setQrError(d.error || 'Não foi possível gerar o QR Code.')
      }
    } catch {
      setQrError('Erro ao conectar com a Evolution API.')
    }
    setLoadingQr(false)
  }

  function handleCertUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCertFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      // result e' "data:application/x-pkcs12;base64,XXXX" — pegamos apenas o base64
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      setForm((f) => ({ ...f, pixPspCertBase64: base64 }))
    }
    reader.readAsDataURL(file)
  }

  async function testPspConnection() {
    setTestingPsp(true)
    setPspStatus(null)
    // Garante que credenciais salvas antes de testar
    await fetch('/api/configuracoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    try {
      const res = await fetch('/api/admin/test-psp', { method: 'POST' })
      const d = await res.json()
      setPspStatus({ ok: d.ok || false, message: d.message || d.error || 'Erro desconhecido' })
    } catch (err) {
      setPspStatus({ ok: false, message: String(err) })
    }
    setTestingPsp(false)
  }

  function generateWebhookSecret() {
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    const secret = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
    setForm((f) => ({ ...f, pixPspWebhookSecret: secret }))
  }

  async function sendTestMessage() {
    if (!testPhone.trim()) return
    setSendingTest(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      })
      const d = await res.json()
      setTestResult({ ok: d.ok || false, message: d.message || d.error || 'Erro desconhecido' })
    } catch {
      setTestResult({ ok: false, message: 'Erro ao enviar mensagem de teste.' })
    }
    setSendingTest(false)
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    const previousErpType = data?.settings?.erpType
    await fetch('/api/configuracoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)

    // Se o erpType mudou, recarrega a pagina para o Sidebar refletir
    // os novos itens de menu (Produtos, Assinaturas, Contas a Receber)
    if (previousErpType && previousErpType !== form.erpType) {
      setTimeout(() => window.location.reload(), 600)
      return
    }

    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Carregando...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configurações</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gerencie sua empresa e integrações</p>
        </div>
        <Button onClick={save} loading={saving} size="sm">
          {saved ? <><CheckCircle size={14} /> Salvo!</> : 'Salvar alterações'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-[#1e1b4b] text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logo da empresa</label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-xl object-contain border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-purple-50 dark:bg-purple-900/30 border-2 border-dashed border-purple-200 dark:border-purple-700 flex items-center justify-center text-purple-300 text-xs">
                      Logo
                    </div>
                  )}
                  <label className="cursor-pointer text-sm text-purple-700 dark:text-purple-400 font-medium hover:underline">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sistema ERP</label>
                <select
                  name="erpType"
                  value={form.erpType as string}
                  onChange={handleChange}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="sgp">SGP TSMX</option>
                  <option value="hubsoft">HubSoft</option>
                  <option value="manual">Banco próprio do sistema</option>
                  <option value="csv_import">Importação CSV (em breve)</option>
                  <option value="webhook">Webhook (em breve)</option>
                </select>
              </div>

              {form.erpType === 'manual' && (
                <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-sm text-purple-800 dark:text-purple-300">
                  <strong>Banco próprio do sistema.</strong> Você gerencia diretamente no sistema:
                  Clientes, Produtos/Serviços e Contas a Receber. As cobranças usarão PIX dinâmico
                  via PSP (configure na aba PIX).
                </div>
              )}
              {form.erpType === 'sgp' && (
                <>
                  <Field label="URL do SGP" name="sgpBaseUrl" value={form.sgpBaseUrl as string} onChange={handleChange} placeholder="https://suaempresa.sgp.net.br" />
                  <Field label="Token SGP" name="sgpToken" value={form.sgpToken as string} onChange={handleChange} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  <Field label="App SGP" name="sgpApp" value={form.sgpApp as string} onChange={handleChange} placeholder="isp-cobranca" />
                </>
              )}
              {form.erpType === 'hubsoft' && (
                <>
                  <Field label="URL da API HubSoft" name="hubsoftBaseUrl" value={form.hubsoftBaseUrl as string} onChange={handleChange} placeholder="https://api.suaempresa.com.br" />
                  <Field label="Client ID" name="hubsoftClientId" value={form.hubsoftClientId as string} onChange={handleChange} placeholder="ID do client OAuth" />
                  <Field label="Client Secret" name="hubsoftClientSecret" value={form.hubsoftClientSecret as string} onChange={handleChange} placeholder="Secret do client OAuth" />
                  <Field label="Usuário (e-mail)" name="hubsoftUsername" value={form.hubsoftUsername as string} onChange={handleChange} placeholder="usuario@empresa.com.br" />
                  <Field label="Senha" name="hubsoftPassword" value={form.hubsoftPassword as string} onChange={handleChange} placeholder="Senha do usuário API" type="password" />
                </>
              )}

              {(form.erpType === 'sgp' || form.erpType === 'hubsoft') && (
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Testar Conexão</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Salva as credenciais e testa a conexão com a API do ERP.</p>
                    </div>
                    <button
                      onClick={testErpConnection}
                      disabled={testingErp}
                      className="flex items-center gap-2 text-sm bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {testingErp
                        ? <><Loader2 size={14} className="animate-spin" /> Testando...</>
                        : <><Wifi size={14} /> Testar Conexão</>}
                    </button>
                  </div>
                  {erpStatus && (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                      erpStatus.ok
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700'
                        : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                    }`}>
                      {erpStatus.ok ? <CheckCircle size={16} /> : <span>&#10060;</span>}
                      {erpStatus.message}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'whatsapp' && (
            <>
              <Field label="URL da Evolution API" name="evolutionBaseUrl" value={form.evolutionBaseUrl as string} onChange={handleChange} placeholder="https://evolution.suaempresa.com" />
              <Field label="API Key" name="evolutionApiKey" value={form.evolutionApiKey as string} onChange={handleChange} placeholder="Chave de API" />
              <Field label="Nome da instância" name="evolutionInstance" value={form.evolutionInstance as string} onChange={handleChange} placeholder="minha-instancia" />

              {/* Status e Conexão */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Status da Conexão</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={testWhatsapp}
                      disabled={testingWpp}
                      className="flex items-center gap-2 text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                    >
                      {testingWpp
                        ? <><Loader2 size={14} className="animate-spin" /> Verificando...</>
                        : <><RefreshCw size={14} /> Verificar Conexão</>}
                    </button>
                    <button
                      onClick={generateQrCode}
                      disabled={loadingQr}
                      className="flex items-center gap-2 text-sm bg-[#1e1b4b] text-white px-4 py-2 rounded-lg hover:bg-[#312e81] disabled:opacity-60 transition-colors"
                    >
                      {loadingQr
                        ? <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                        : <><QrCode size={14} /> Conectar WhatsApp</>}
                    </button>
                  </div>
                </div>

                {wppStatus && (
                  <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                    wppStatus.ok
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700'
                      : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                  }`}>
                    {wppStatus.ok ? <CheckCircle size={16} /> : <span>&#10060;</span>}
                    {wppStatus.message}
                  </div>
                )}

                {qrError && (
                  <div className="px-4 py-3 rounded-lg text-sm bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                    {qrError}
                  </div>
                )}

                {qrCode && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Escaneie o QR Code com seu WhatsApp:</p>
                    <div className="bg-white p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 shadow-sm">
                      <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64" />
                    </div>
                    <p className="text-xs text-gray-400">O QR Code expira em alguns segundos. Se expirar, clique em &quot;Conectar WhatsApp&quot; novamente.</p>
                    <button
                      onClick={() => { setQrCode(null); testWhatsapp() }}
                      className="text-sm text-purple-700 dark:text-purple-400 font-medium hover:underline"
                    >
                      Já escaneei, verificar conexão
                    </button>
                  </div>
                )}
              </div>

              <hr className="border-gray-100 dark:border-gray-700" />
              <Field label="WhatsApp de atendimento" name="companyWhatsapp" value={form.companyWhatsapp as string} onChange={handleChange} placeholder="(37) 99999-9999" />
              <Field label="Horário de atendimento" name="companyHours" value={form.companyHours as string} onChange={handleChange} placeholder="Seg-Sex 8h às 18h | Sáb 8h às 12h" />

              <hr className="border-gray-100 dark:border-gray-700" />

              {/* Enviar mensagem de teste */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Enviar Mensagem de Teste</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Envie uma mensagem real para verificar se o envio está funcionando corretamente.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="(37) 99999-9999"
                    className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={sendTestMessage}
                    disabled={sendingTest || !testPhone.trim()}
                    className="flex items-center gap-2 text-sm bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    {sendingTest
                      ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                      : <><Send size={14} /> Enviar Teste</>}
                  </button>
                </div>
                {testResult && (
                  <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                    testResult.ok
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700'
                      : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                  }`}>
                    {testResult.ok ? <CheckCircle size={16} /> : <span>&#10060;</span>}
                    {testResult.message}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'pix' && (
            <>
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-600 dark:text-gray-400">
                Configure o provedor PSP para emissão de PIX dinâmico (com TXID identificador).
                As cobranças geradas no modo <strong>Banco próprio</strong> usarão essa integração
                para criar QR Codes e receber confirmação automática via webhook.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provedor PSP</label>
                <select
                  name="pixPsp"
                  value={(form.pixPsp as string) || ''}
                  onChange={handleChange}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {PSP_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Apenas C6 Bank tem integração real implementada nesta versão. Outros PSPs aparecerão em breve.</p>
              </div>

              {form.pixPsp && form.pixPsp !== '' && (
                <>
                  {!PSP_IMPLEMENTED.has(form.pixPsp as string) && (
                    <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300">
                      Integração ainda não implementada para esse PSP. Você pode salvar as credenciais, mas a emissão de cobrança e o webhook ainda não funcionarão.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ambiente</label>
                      <select
                        name="pixPspEnv"
                        value={(form.pixPspEnv as string) || 'sandbox'}
                        onChange={handleChange}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="sandbox">Sandbox / Homologação</option>
                        <option value="production">Produção</option>
                      </select>
                    </div>
                    <Field label="URL base (opcional)" name="pixPspBaseUrl" value={form.pixPspBaseUrl as string} onChange={handleChange} placeholder="Sobrescreve URL padrão do PSP" />
                  </div>

                  <Field label="Client ID" name="pixPspClientId" value={form.pixPspClientId as string} onChange={handleChange} placeholder="Identificador OAuth gerado no portal do PSP" />
                  <Field label="Client Secret" name="pixPspClientSecret" value={form.pixPspClientSecret as string} onChange={handleChange} placeholder="Secret OAuth (mantido em sigilo)" type="password" />
                  <Field label="API Key (opcional)" name="pixPspApiKey" value={form.pixPspApiKey as string} onChange={handleChange} placeholder="Alguns PSPs usam API key adicional" />

                  {/* Certificado mTLS */}
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Certificado mTLS (.pfx)
                      <span className="text-xs text-gray-400 font-normal ml-1">— obrigatório para C6, Sicoob, BB</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pfx,.p12"
                        onChange={handleCertUpload}
                        className="flex-1 text-xs text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
                      />
                      {(certFileName || form.pixPspCertBase64) && (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle size={12} /> {certFileName || 'cert salvo'}
                        </span>
                      )}
                    </div>
                    <Field label="Senha do certificado" name="pixPspCertPassword" value={form.pixPspCertPassword as string} onChange={handleChange} placeholder="Senha definida ao gerar o .pfx" type="password" />
                  </div>

                  {/* Webhook */}
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Webhook Secret</label>
                      <button
                        type="button"
                        onClick={generateWebhookSecret}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        Gerar novo
                      </button>
                    </div>
                    <Field label="" name="pixPspWebhookSecret" value={form.pixPspWebhookSecret as string} onChange={handleChange} placeholder="Clique em 'Gerar novo' para criar" type="password" />
                    {form.pixPspWebhookSecret && (
                      <div className="mt-2 p-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 mb-1">Cadastre essa URL no portal do {PSP_OPTIONS.find(p => p.id === form.pixPsp)?.label}:</div>
                        <code className="text-xs break-all text-purple-700 dark:text-purple-300">
                          {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/pix/{form.pixPsp}/{form.pixPspWebhookSecret}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Botão testar conexão */}
                  {PSP_IMPLEMENTED.has(form.pixPsp as string) && (
                    <div>
                      <Button onClick={testPspConnection} loading={testingPsp} variant="secondary" size="sm">
                        Testar conexão
                      </Button>
                      {pspStatus && (
                        <div className={`mt-2 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                          pspStatus.ok
                            ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        }`}>
                          {pspStatus.ok ? <CheckCircle size={16} /> : <span>&#10060;</span>}
                          {pspStatus.message}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-5 mt-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Dados do recebedor (impressos no QR Code)</h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo da chave PIX</label>
                      <select
                        name="pixKeyType"
                        value={(form.pixKeyType as string) || ''}
                        onChange={handleChange}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">— Selecione —</option>
                        <option value="cpf">CPF</option>
                        <option value="cnpj">CNPJ</option>
                        <option value="email">E-mail</option>
                        <option value="phone">Telefone</option>
                        <option value="aleatoria">Chave aleatória</option>
                      </select>
                    </div>
                    <Field label="Valor da chave PIX" name="pixKeyValue" value={form.pixKeyValue as string} onChange={handleChange} placeholder="Ex: 12345678900 ou contato@empresa.com" />
                    <Field label="Nome do recebedor" name="pixBeneficiaryName" value={form.pixBeneficiaryName as string} onChange={handleChange} placeholder="Razão social ou nome registrado no PSP" />
                    <Field label="Cidade do recebedor" name="pixBeneficiaryCity" value={form.pixBeneficiaryCity as string} onChange={handleChange} placeholder="Ex: PIUMHI" />
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'cobrancas' && (
            <>
              <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-700">
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">Modo Teste</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Quando ativo, mensagens são bloqueadas e apenas logadas</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="testMode"
                    checked={form.testMode as boolean}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Início da janela" name="sendWindowStart" value={form.sendWindowStart as string} onChange={handleChange} type="time" />
                <Field label="Fim da janela" name="sendWindowEnd" value={form.sendWindowEnd as string} onChange={handleChange} type="time" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dias de envio</label>
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
                          active ? 'bg-[#1e1b4b] text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
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
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400"
      />
    </div>
  )
}
