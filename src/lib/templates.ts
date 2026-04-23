import type { Stage, StageConfig, MessageTemplate, TemplateVars, ConsolidatedTemplateVars, InvoiceItem } from '@/types'

export const STAGES: StageConfig[] = [
  {
    stage: 'D_MINUS_5',
    dayOffset: -5,
    label: 'Lembrete Antecipado',
    shortLabel: 'D-5',
    hasBoleto: false,
    hasPix: false,
    tone: 'Leve e carinhoso',
    description: 'Primeiro contato. Aviso gentil sem nenhuma pressão. Apenas lembra que a fatura está chegando.',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  {
    stage: 'D_MINUS_2',
    dayOffset: -2,
    label: 'Envio do Boleto',
    shortLabel: 'D-2',
    hasBoleto: true,
    hasPix: true,
    tone: 'Prático e animado',
    description: 'Facilita o pagamento enviando boleto e PIX prontos. Tom direto mas alegre.',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  {
    stage: 'D_ZERO',
    dayOffset: 0,
    label: 'Dia do Vencimento',
    shortLabel: 'D-0',
    hasBoleto: true,
    hasPix: true,
    tone: 'Atencioso',
    description: 'Dia do vencimento. Tom cuidadoso, último lembrete antes de vencer.',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  {
    stage: 'D_PLUS_1',
    dayOffset: 1,
    label: 'Aviso Pós-Vencimento',
    shortLabel: 'D+1',
    hasBoleto: true,
    hasPix: true,
    tone: 'Tranquilo e compreensivo',
    description: 'Aviso que venceu mas sem drama. Transmite tranquilidade — ainda dá pra pagar normalmente.',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  {
    stage: 'D_PLUS_5',
    dayOffset: 5,
    label: 'Lembrete de Regularização',
    shortLabel: 'D+5',
    hasBoleto: true,
    hasPix: true,
    tone: 'Amigável e incentivador',
    description: 'Alguns dias em aberto. Tom que quer ajudar a resolver rápido. Foco no benefício (internet voando).',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  {
    stage: 'D_PLUS_10',
    dayOffset: 10,
    label: 'Última Facilidade',
    shortLabel: 'D+10',
    hasBoleto: true,
    hasPix: true,
    tone: 'Empático com boleto',
    description: 'Tom compreensivo. Envia boleto e PIX pra facilitar a regularização. Oferece canal de atendimento como alternativa.',
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  {
    stage: 'D_PLUS_14',
    dayOffset: 14,
    label: 'Aviso de Suspensão',
    shortLabel: 'D+14',
    hasBoleto: false,
    hasPix: false,
    tone: 'Sério e direto',
    description: 'Último aviso antes da suspensão. Tom firme mas respeitoso. Sem boleto — direciona para atendimento imediato.',
    color: 'bg-rose-200 text-rose-800 border-rose-300',
  },
]

export function getStageConfig(stage: Stage): StageConfig {
  const config = STAGES.find((s) => s.stage === stage)
  if (!config) throw new Error(`Stage não encontrado: ${stage}`)
  return config
}

export const TEMPLATES: MessageTemplate[] = [
  {
    stage: 'D_MINUS_5',
    mainMessage: (v: TemplateVars) => `Oi, ${v.nome}! Tudo bem? 😊

Sua fatura da *${v.company_name || 'sua operadora'}* tá chegando! Vence dia *${v.data_vencimento}*.

🔥 Valor: *R$ ${v.valor}*

Só passando pra te avisar! 😄

Qualquer coisa, estamos por aqui!`,
  },
  {
    stage: 'D_MINUS_2',
    mainMessage: (v: TemplateVars) => `Oi, ${v.nome}! 😄

Sua fatura da *${v.company_name || 'sua operadora'}* vence dia *${v.data_vencimento}*!

🔥 Valor: *R$ ${v.valor}*

Pra facilitar, segue o boleto e o PIX prontinho pra você 👇`,
    pixMessage: (v: TemplateVars) => `🔗 Boleto: ${v.link_boleto || '(link do boleto)'}`,
  },
  {
    stage: 'D_ZERO',
    mainMessage: (v: TemplateVars) => `Oi, ${v.nome}! 👋

Sua fatura da *${v.company_name || 'sua operadora'}* vence *hoje*!

🔥 Valor: *R$ ${v.valor}*

Ainda dá tempo de pagar e manter sua internet voando! 🚀`,
    pixMessage: (v: TemplateVars) => `🔗 Boleto: ${v.link_boleto || '(link do boleto)'}`,
  },
  {
    stage: 'D_PLUS_1',
    mainMessage: (v: TemplateVars) => `Oi, ${v.nome}! Tudo certo? 🙂

Passando pra avisar que sua fatura da *${v.company_name || 'sua operadora'}* venceu ontem (*${v.data_vencimento}*).

🔥 Valor: *R$ ${v.valor}*

Mas relaxa, ainda dá pra pagar tranquilamente pelo boleto ou PIX! 😉`,
    pixMessage: (v: TemplateVars) => `🔗 Boleto: ${v.link_boleto || '(link do boleto)'}`,
  },
  {
    stage: 'D_PLUS_5',
    mainMessage: (v: TemplateVars) => `Oi, ${v.nome}! 👋

Sua fatura da *${v.company_name || 'sua operadora'}* tá com alguns dias em aberto e a gente quer te ajudar a resolver rapidinho!

🔥 Valor: *R$ ${v.valor}*

Regularizando, sua internet continua voando! 🚀`,
    pixMessage: (v: TemplateVars) => `🔗 Boleto atualizado: ${v.link_boleto || '(link do boleto)'}`,
  },
  {
    stage: 'D_PLUS_10',
    mainMessage: (v: TemplateVars) => `Oi, ${v.nome}!

A gente sabe que a correria do dia a dia é grande, mas sua fatura da *${v.company_name || 'sua operadora'}* tá precisando de uma atenção!

🔥 Valor: *R$ ${v.valor}*

A gente quer te ajudar a resolver da melhor forma possível. 🤝

Ou fale com a gente:
📞 *${v.company_whatsapp || '(número)'}*
🕐 Seg-Sex 8h às 18h | Sáb 8h às 12h`,
    pixMessage: (v: TemplateVars) => `🔗 Boleto: ${v.link_boleto || '(link do boleto)'}`,
  },
  {
    stage: 'D_PLUS_14',
    mainMessage: (v: TemplateVars) => `${v.nome}, precisamos falar sobre sua fatura da *${v.company_name || 'sua operadora'}*.

Sua conta está em aberto há mais de 14 dias e infelizmente o *serviço será suspenso amanhã* caso não seja regularizada.

🔥 Valor: *R$ ${v.valor}*

Sabemos que imprevistos acontecem. Se precisar de ajuda, entre em contato agora mesmo:

📞 WhatsApp: *${v.company_whatsapp || '(número)'}*
🕐 Seg-Sex 8h às 18h | Sáb 8h às 12h

Evite a suspensão — regularize hoje.`,
  },
]

export type CustomTemplates = Partial<Record<Stage, { mainMessage: string; pixMessage?: string }>>

/**
 * Substitui variáveis no formato {nome}, {valor}, etc. em strings de template.
 */
function applyVars(text: string, vars: TemplateVars & Record<string, string | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

export function renderTemplate(
  stage: Stage,
  vars: TemplateVars,
  custom?: CustomTemplates,
): { mainMessage: string; pixMessage?: string } {
  // Se a empresa tem template customizado para este estágio, usa ele
  const customStage = custom?.[stage]
  if (customStage?.mainMessage) {
    return {
      mainMessage: applyVars(customStage.mainMessage, vars as TemplateVars & Record<string, string | undefined>),
      pixMessage: customStage.pixMessage
        ? applyVars(customStage.pixMessage, vars as TemplateVars & Record<string, string | undefined>)
        : undefined,
    }
  }

  // Fallback para template padrão (funções JS)
  const template = TEMPLATES.find((t) => t.stage === stage)
  if (!template) throw new Error(`Template não encontrado para stage: ${stage}`)

  return {
    mainMessage: template.mainMessage(vars),
    pixMessage: template.pixMessage ? template.pixMessage(vars) : undefined,
  }
}

export function getStageByOffset(offset: number): Stage | null {
  const stage = STAGES.find((s) => s.dayOffset === offset)
  return stage ? stage.stage : null
}

// ─── Templates consolidados (cliente com mais de 1 fatura no mesmo estágio) ──

function renderInvoiceList(faturas: InvoiceItem[], includeBoleto: boolean): string {
  return faturas.map((f, i) => {
    const lines = [
      `*${i + 1}. ${f.planName}* — Vence ${f.data_vencimento}`,
      `   💰 R$ ${f.valor}`,
    ]
    if (includeBoleto && f.link_boleto) lines.push(`   🔗 Boleto: ${f.link_boleto}`)
    return lines.join('\n')
  }).join('\n\n')
}

const CONSOLIDATED: Partial<Record<Stage, (v: ConsolidatedTemplateVars) => string>> = {
  D_MINUS_5: (v) => `Oi, ${v.nome}! Tudo bem? 😊

Você tem *${v.total_faturas} faturas* da *${v.company_name || 'sua operadora'}* chegando:

${renderInvoiceList(v.faturas, false)}

🔥 *Total: R$ ${v.valor_total}*

Só passando pra te avisar! 😄`,

  D_MINUS_2: (v) => `Oi, ${v.nome}! 😄

Você tem *${v.total_faturas} faturas* da *${v.company_name || 'sua operadora'}* vencendo em breve. Segue boleto e PIX de cada uma:

${renderInvoiceList(v.faturas, true)}

🔥 *Total: R$ ${v.valor_total}*`,

  D_ZERO: (v) => `Oi, ${v.nome}! 👋

Você tem *${v.total_faturas} faturas* da *${v.company_name || 'sua operadora'}* vencendo *hoje*:

${renderInvoiceList(v.faturas, true)}

🔥 *Total: R$ ${v.valor_total}*

Ainda dá tempo! 🚀`,

  D_PLUS_1: (v) => `Oi, ${v.nome}! Tudo certo? 🙂

Suas *${v.total_faturas} faturas* da *${v.company_name || 'sua operadora'}* venceram ontem:

${renderInvoiceList(v.faturas, true)}

🔥 *Total: R$ ${v.valor_total}*

Ainda dá pra pagar tranquilamente! 😉`,

  D_PLUS_5: (v) => `Oi, ${v.nome}! 👋

Você tem *${v.total_faturas} faturas* da *${v.company_name || 'sua operadora'}* em aberto. Vamos resolver juntos:

${renderInvoiceList(v.faturas, true)}

🔥 *Total: R$ ${v.valor_total}*`,

  D_PLUS_10: (v) => `Oi, ${v.nome}!

Suas *${v.total_faturas} faturas* da *${v.company_name || 'sua operadora'}* precisam de atenção:

${renderInvoiceList(v.faturas, true)}

🔥 *Total: R$ ${v.valor_total}*

Ou fale com a gente:
📞 *${v.company_whatsapp || '(número)'}*
🕐 Seg-Sex 8h às 18h | Sáb 8h às 12h`,

  D_PLUS_14: (v) => `${v.nome}, precisamos falar sobre suas *${v.total_faturas} faturas* da *${v.company_name || 'sua operadora'}*.

${renderInvoiceList(v.faturas, false)}

🔥 *Total em aberto: R$ ${v.valor_total}*

O *serviço será suspenso amanhã* caso não seja regularizado.

📞 WhatsApp: *${v.company_whatsapp || '(número)'}*
🕐 Seg-Sex 8h às 18h | Sáb 8h às 12h

Evite a suspensão — regularize hoje.`,
}

export function renderConsolidatedTemplate(stage: Stage, vars: ConsolidatedTemplateVars): string | null {
  const fn = CONSOLIDATED[stage]
  return fn ? fn(vars) : null
}

