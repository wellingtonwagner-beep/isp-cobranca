'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Stethoscope, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface Diagnostico {
  today: string
  nowBrt: string
  logsByDay: Record<string, Record<string, number>>
  lastSent: { sentAt: string; stage: string; whatsappTo: string; client?: { name: string } | null } | null
  eligibleByStage: { stage: string; label: string; targetDate: string; eligible: number; alreadySent: number }[]
  config: {
    testMode: boolean
    sendWindowStart: string
    sendWindowEnd: string
    sendDays: string
    withinSendWindow: boolean
    erpType: string
    erpConfigured: boolean
    evolutionConfigured: boolean
  }
}

const statusOrder = ['sent', 'failed', 'skipped_no_phone', 'blocked_duplicate', 'blocked_test', 'skipped_paid']
const statusLabels: Record<string, string> = {
  sent: 'Enviadas',
  failed: 'Falhas',
  skipped_no_phone: 'Sem telefone',
  blocked_duplicate: 'Duplicadas',
  blocked_test: 'Modo teste',
  skipped_paid: 'Já pago',
}
const statusColors: Record<string, string> = {
  sent: 'text-green-600 dark:text-green-400',
  failed: 'text-red-600 dark:text-red-400',
  skipped_no_phone: 'text-gray-500',
  blocked_duplicate: 'text-blue-500',
  blocked_test: 'text-amber-500',
  skipped_paid: 'text-gray-400',
}
const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const stageLabels: Record<string, string> = {
  D_MINUS_5: 'D-5', D_MINUS_2: 'D-2', D_ZERO: 'D-0',
  D_PLUS_1: 'D+1', D_PLUS_5: 'D+5', D_PLUS_10: 'D+10', D_PLUS_14: 'D+14',
}

export default function DiagnosticoPage() {
  const [data, setData] = useState<Diagnostico | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/diagnostico')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalEligibleHoje = data?.eligibleByStage.reduce((s, e) => s + (e.eligible - e.alreadySent), 0) || 0
  const totalSentHoje = data?.logsByDay[data?.today]?.['sent'] || 0
  const totalLogsHoje = data ? Object.values(data.logsByDay[data.today] || {}).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Diagnóstico de Disparo</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Validação rápida do estado do sistema de cobrança
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

      {loading && !data ? (
        <Card><CardContent className="py-12 text-center text-gray-400 text-sm">Coletando dados...</CardContent></Card>
      ) : !data ? (
        <Card><CardContent className="py-12 text-center text-gray-400 text-sm">Erro ao carregar diagnóstico.</CardContent></Card>
      ) : (
        <>
          {/* Diagnóstico rápido */}
          <Card>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Status atual</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Servidor: {data.nowBrt}</p>
            </div>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                <DiagItem
                  ok={data.config.evolutionConfigured}
                  label="WhatsApp (Evolution API)"
                  detail={data.config.evolutionConfigured ? 'Configurado' : 'Não configurado — vá em Configurações > WhatsApp'}
                />
                <DiagItem
                  ok={data.config.erpConfigured}
                  label={`ERP (${data.config.erpType.toUpperCase()})`}
                  detail={data.config.erpConfigured ? 'Configurado' : 'Não configurado — vá em Configurações > ERP'}
                />
                <DiagItem
                  ok={!data.config.testMode}
                  warn={data.config.testMode}
                  label="Modo de produção"
                  detail={data.config.testMode ? 'MODO TESTE LIGADO — mensagens não são realmente enviadas' : 'Mensagens enviadas de verdade'}
                />
                <DiagItem
                  ok={data.config.withinSendWindow}
                  warn={!data.config.withinSendWindow}
                  label="Janela de envio"
                  detail={`${data.config.sendWindowStart}–${data.config.sendWindowEnd}, dias ${data.config.sendDays} ${data.config.withinSendWindow ? '(dentro da janela)' : '(FORA da janela agora)'}`}
                />
              </div>

              {data.lastSent ? (
                <div className="mt-4 p-3 rounded bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 text-sm">
                  <div className="font-medium text-green-700 dark:text-green-300">
                    Última mensagem enviada com sucesso
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {new Date(data.lastSent.sentAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} — estágio {stageLabels[data.lastSent.stage] || data.lastSent.stage} para {data.lastSent.client?.name || 'cliente'} ({data.lastSent.whatsappTo})
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3 rounded bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-sm">
                  <div className="font-medium text-red-700 dark:text-red-300">Nenhuma mensagem foi enviada com sucesso ainda</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo de hoje */}
          <Card>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Hoje ({data.today})</h2>
            </div>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-3">
                <Stat label="Faturas elegíveis (não enviadas ainda)" value={totalEligibleHoje} color={totalEligibleHoje > 0 ? 'text-amber-600' : 'text-gray-500'} />
                <Stat label="Mensagens registradas hoje" value={totalLogsHoje} color={totalLogsHoje > 0 ? 'text-blue-600' : 'text-gray-500'} />
                <Stat label="Enviadas com sucesso hoje" value={totalSentHoje} color={totalSentHoje > 0 ? 'text-green-600' : 'text-gray-500'} />
              </div>

              {totalEligibleHoje > 0 && totalLogsHoje === 0 && (
                <div className="mt-4 p-3 rounded bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-sm text-amber-800 dark:text-amber-300">
                  <strong>Atenção:</strong> existem {totalEligibleHoje} fatura(s) elegíveis mas nenhuma mensagem foi processada hoje. Possíveis causas: cron-server parado, fora da janela de envio, ou clique no botão &quot;Disparar cobranças agora&quot; em Cobranças.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Faturas elegíveis por estágio */}
          <Card>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Elegíveis por estágio (hoje)</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">O que o billing engine processaria se rodasse agora</p>
            </div>
            <CardContent className="p-0">
              {data.eligibleByStage.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">Nenhuma fatura elegível em nenhum estágio hoje.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                      <th className="px-4 py-2 text-left">Estágio</th>
                      <th className="px-4 py-2 text-left">Vencimento alvo</th>
                      <th className="px-4 py-2 text-right">Faturas elegíveis</th>
                      <th className="px-4 py-2 text-right">Já enviadas</th>
                      <th className="px-4 py-2 text-right">Pendentes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.eligibleByStage.map((e) => {
                      const pendentes = e.eligible - e.alreadySent
                      return (
                        <tr key={e.stage} className="border-b border-gray-50 dark:border-gray-700/50">
                          <td className="px-4 py-2.5">
                            <Badge variant="info">{e.label}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{e.targetDate}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{e.eligible}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{e.alreadySent}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${pendentes > 0 ? 'text-amber-600' : 'text-green-600'}`}>{pendentes}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Histórico 7 dias */}
          <Card>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Últimos 7 dias</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Quantidade de mensagens registradas por dia, por status</p>
            </div>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                      <th className="px-4 py-2 text-left">Dia</th>
                      {statusOrder.map((s) => (
                        <th key={s} className={`px-4 py-2 text-right ${statusColors[s]}`}>{statusLabels[s]}</th>
                      ))}
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.logsByDay).map(([day, counts]) => {
                      const total = Object.values(counts).reduce((a, b) => a + b, 0)
                      const d = new Date(`${day}T12:00:00.000Z`)
                      const isToday = day === data.today
                      return (
                        <tr key={day} className={`border-b border-gray-50 dark:border-gray-700/50 ${isToday ? 'bg-purple-50/40 dark:bg-purple-900/10' : ''}`}>
                          <td className="px-4 py-2 font-medium">
                            {dayLabels[d.getUTCDay()]} {day}
                            {isToday && <span className="ml-1 text-xs text-purple-600 dark:text-purple-400">(hoje)</span>}
                          </td>
                          {statusOrder.map((s) => (
                            <td key={s} className={`px-4 py-2 text-right ${counts[s] ? statusColors[s] : 'text-gray-300 dark:text-gray-700'}`}>
                              {counts[s] || 0}
                            </td>
                          ))}
                          <td className={`px-4 py-2 text-right font-bold ${total > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-700'}`}>{total}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function DiagItem({ ok, warn, label, detail }: { ok: boolean; warn?: boolean; label: string; detail: string }) {
  const Icon = ok ? CheckCircle : warn ? AlertTriangle : XCircle
  const color = ok ? 'text-green-600' : warn ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="flex items-start gap-3 p-3 rounded border border-gray-100 dark:border-gray-700">
      <Icon className={`w-5 h-5 ${color} flex-shrink-0 mt-0.5`} />
      <div>
        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{label}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{detail}</div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-3 rounded border border-gray-100 dark:border-gray-700">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  )
}
