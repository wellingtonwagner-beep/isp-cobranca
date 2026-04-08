import { STAGES, renderTemplate } from '@/lib/templates'
import { Card, CardContent } from '@/components/ui/card'
import { Check, X } from 'lucide-react'

export default function WorkflowPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Workflow de Cobrança</h1>
        <p className="text-gray-500 text-sm mt-1">
          Fluxo automatizado de {STAGES.length} estágios, de D-5 (5 dias antes) até D+14 (14 dias depois do vencimento).
          Cada cliente recebe no máximo 1 mensagem por estágio por fatura.
        </p>
      </div>

      {/* Timeline do fluxo */}
      <Card className="mb-8">
        <CardContent className="py-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Fluxo de Disparos</h2>
          <div className="flex items-center gap-1 flex-wrap">
            {STAGES.map((stage, i) => (
              <div key={stage.stage} className="flex items-center gap-1">
                <div className={`${stage.color} border px-3 py-1.5 rounded-lg text-xs font-bold text-center min-w-[64px]`}>
                  <div>{stage.shortLabel}</div>
                  <div className="font-normal text-[10px] opacity-80 leading-tight mt-0.5">{stage.label}</div>
                </div>
                {i < STAGES.length - 1 && (
                  <span className="text-gray-300 text-sm">›</span>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-xs text-gray-600 border-t border-gray-100 pt-4">
            <div><span className="font-semibold">Janela de envio:</span> 08:00 às 20:00</div>
            <div><span className="font-semibold">Dias:</span> Segunda a Sábado</div>
            <div><span className="font-semibold">Anti-duplicata:</span> 1 mensagem por estágio por fatura</div>
            <div><span className="font-semibold">Feriados:</span> Não envia (consulta SGP)</div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de cada estágio */}
      <div className="space-y-5">
        {STAGES.map((stage) => {
          const preview = renderTemplate(stage.stage, {
            nome: '{{nome}}',
            data_vencimento: '{{data_vencimento}}',
            valor: '{{valor}}',
            link_boleto: '{{link_boleto}}',
            codigo_pix: '{{codigo_pix}}',
          })

          return (
            <Card key={stage.stage}>
              <CardContent className="py-5">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <span className={`${stage.color} border px-2.5 py-1 rounded-lg text-xs font-bold`}>
                    {stage.shortLabel}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800">{stage.label}</h3>
                      <span className="text-xs text-gray-400">
                        — {stage.dayOffset < 0
                          ? `${Math.abs(stage.dayOffset)} dias antes do vencimento`
                          : stage.dayOffset === 0
                          ? 'Dia do vencimento'
                          : `${stage.dayOffset} dias após o vencimento`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-gray-500">
                        <span className="font-medium">Tom:</span> {stage.tone}
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        {stage.hasBoleto ? (
                          <><Check size={11} className="text-green-500" /><span className="text-green-600 font-medium">Boleto</span></>
                        ) : (
                          <><X size={11} className="text-gray-300" /><span className="text-gray-400">Boleto</span></>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        {stage.hasPix ? (
                          <><Check size={11} className="text-green-500" /><span className="text-green-600 font-medium">PIX</span></>
                        ) : (
                          <><X size={11} className="text-gray-300" /><span className="text-gray-400">PIX</span></>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{stage.description}</p>
                  </div>
                </div>

                {/* Preview da mensagem */}
                <div className="bg-gray-50 rounded-lg p-4 mt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                    Mensagem Enviada:
                  </p>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {preview.mainMessage}
                  </pre>
                  {preview.pixMessage && (
                    <>
                      <div className="border-t border-gray-200 mt-3 pt-3">
                        <p className="text-xs text-gray-400 italic mb-1">[mensagem separada com código PIX]</p>
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                          {preview.pixMessage}
                        </pre>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
