'use client'

import { useEffect, useState, useCallback } from 'react'
import { STAGES } from '@/lib/templates'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, X, Edit2, RotateCcw, Save } from 'lucide-react'
import type { Stage } from '@/types'

interface TemplateData {
  stage: Stage
  mainMessage: string
  pixMessage?: string
  isCustom: boolean
}

const VARS_HELP = [
  { var: '{nome}', desc: 'Primeiro nome do cliente' },
  { var: '{data_vencimento}', desc: 'Data de vencimento (DD/MM/AAAA)' },
  { var: '{valor}', desc: 'Valor da fatura (R$ 0,00)' },
  { var: '{link_boleto}', desc: 'Link do boleto' },
  { var: '{codigo_pix}', desc: 'Código PIX copia e cola' },
]

export default function WorkflowPage() {
  const [templates, setTemplates] = useState<TemplateData[]>([])
  const [editing, setEditing] = useState<Stage | null>(null)
  const [draft, setDraft] = useState<{ mainMessage: string; pixMessage: string }>({ mainMessage: '', pixMessage: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/settings/templates')
    if (res.ok) {
      const data = await res.json()
      setTemplates(data.templates)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(t: TemplateData) {
    setEditing(t.stage)
    setDraft({ mainMessage: t.mainMessage, pixMessage: t.pixMessage || '' })
    setMsg(null)
  }

  async function saveTemplate(stage: Stage) {
    setSaving(true)
    setMsg(null)
    try {
      // Monta objeto com todos os templates customizados atuais + o novo
      const current: Record<string, { mainMessage: string; pixMessage?: string }> = {}
      for (const t of templates) {
        if (t.isCustom) current[t.stage] = { mainMessage: t.mainMessage, pixMessage: t.pixMessage }
      }
      current[stage] = {
        mainMessage: draft.mainMessage,
        pixMessage: draft.pixMessage || undefined,
      }

      const res = await fetch('/api/settings/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: current }),
      })
      if (res.ok) {
        setMsg({ ok: true, text: 'Template salvo com sucesso!' })
        setEditing(null)
        await load()
      } else {
        const d = await res.json()
        setMsg({ ok: false, text: d.error || 'Erro ao salvar.' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function resetTemplate(stage: Stage) {
    setSaving(true)
    setMsg(null)
    try {
      const current: Record<string, { mainMessage: string; pixMessage?: string }> = {}
      for (const t of templates) {
        if (t.isCustom && t.stage !== stage) {
          current[t.stage] = { mainMessage: t.mainMessage, pixMessage: t.pixMessage }
        }
      }
      const res = await fetch('/api/settings/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: current }),
      })
      if (res.ok) {
        setMsg({ ok: true, text: 'Template restaurado para o padrão.' })
        setEditing(null)
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  const stageMap = Object.fromEntries(STAGES.map((s) => [s.stage, s]))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Workflow de Cobrança</h1>
        <p className="text-gray-500 text-sm mt-1">
          Fluxo de {STAGES.length} estágios, de D-5 a D+14. Personalize as mensagens para sua empresa.
        </p>
      </div>

      {/* Timeline */}
      <Card className="mb-6">
        <CardContent className="py-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Fluxo de Disparos</h2>
          <div className="flex items-center gap-1 flex-wrap">
            {STAGES.map((stage, i) => (
              <div key={stage.stage} className="flex items-center gap-1">
                <div className={`${stage.color} border px-3 py-1.5 rounded-lg text-xs font-bold text-center min-w-[64px]`}>
                  <div>{stage.shortLabel}</div>
                  <div className="font-normal text-[10px] opacity-80 leading-tight mt-0.5">{stage.label}</div>
                </div>
                {i < STAGES.length - 1 && <span className="text-gray-300 text-sm">›</span>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-xs text-gray-600 border-t border-gray-100 pt-4">
            <div><span className="font-semibold">Janela de envio:</span> 08:00 às 20:00</div>
            <div><span className="font-semibold">Dias:</span> Segunda a Sábado</div>
            <div><span className="font-semibold">Anti-duplicata:</span> 1 mensagem por estágio por fatura</div>
            <div><span className="font-semibold">Feriados:</span> Não envia</div>
          </div>
        </CardContent>
      </Card>

      {/* Variáveis disponíveis */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Variáveis disponíveis nas mensagens</p>
          <div className="flex flex-wrap gap-2">
            {VARS_HELP.map((v) => (
              <span key={v.var} className="inline-flex items-center gap-1.5 bg-gray-100 rounded px-2 py-1 text-xs">
                <code className="text-purple-700 font-mono">{v.var}</code>
                <span className="text-gray-500">{v.desc}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      {/* Cards de cada estágio */}
      <div className="space-y-4">
        {templates.map((t) => {
          const config = stageMap[t.stage]
          if (!config) return null
          const isEditingThis = editing === t.stage

          return (
            <Card key={t.stage}>
              <CardContent className="py-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <span className={`${config.color} border px-2.5 py-1 rounded-lg text-xs font-bold shrink-0`}>
                      {config.shortLabel}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800">{config.label}</h3>
                        {t.isCustom && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                            Personalizado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-gray-500">
                          <span className="font-medium">Tom padrão:</span> {config.tone}
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          {config.hasBoleto
                            ? <><Check size={11} className="text-green-500" /><span className="text-green-600 font-medium">Boleto</span></>
                            : <><X size={11} className="text-gray-300" /><span className="text-gray-400">Boleto</span></>}
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          {config.hasPix
                            ? <><Check size={11} className="text-green-500" /><span className="text-green-600 font-medium">PIX</span></>
                            : <><X size={11} className="text-gray-300" /><span className="text-gray-400">PIX</span></>}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {t.isCustom && !isEditingThis && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => resetTemplate(t.stage)}
                        loading={saving}
                        title="Restaurar padrão"
                      >
                        <RotateCcw size={13} /> Padrão
                      </Button>
                    )}
                    {!isEditingThis && (
                      <Button variant="secondary" size="sm" onClick={() => startEdit(t)}>
                        <Edit2 size={13} /> Editar
                      </Button>
                    )}
                  </div>
                </div>

                {isEditingThis ? (
                  /* Editor */
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Mensagem principal</label>
                      <textarea
                        className="w-full text-sm border border-gray-200 rounded-lg p-3 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-300 resize-y"
                        rows={8}
                        value={draft.mainMessage}
                        onChange={(e) => setDraft({ ...draft, mainMessage: e.target.value })}
                      />
                    </div>
                    {config.hasPix && (
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          Mensagem PIX <span className="text-gray-400 font-normal">(enviada separadamente com o código)</span>
                        </label>
                        <textarea
                          className="w-full text-sm border border-gray-200 rounded-lg p-3 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-300 resize-y"
                          rows={3}
                          value={draft.pixMessage}
                          onChange={(e) => setDraft({ ...draft, pixMessage: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={() => saveTemplate(t.stage)} loading={saving}>
                        <Save size={13} /> Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Preview */
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      {t.isCustom ? 'Sua mensagem:' : 'Mensagem padrão:'}
                    </p>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {t.mainMessage}
                    </pre>
                    {t.pixMessage && (
                      <div className="border-t border-gray-200 mt-3 pt-3">
                        <p className="text-xs text-gray-400 italic mb-1">[mensagem separada com código PIX]</p>
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                          {t.pixMessage}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
