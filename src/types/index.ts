export type Stage =
  | 'D_MINUS_5'
  | 'D_MINUS_2'
  | 'D_ZERO'
  | 'D_PLUS_1'
  | 'D_PLUS_5'
  | 'D_PLUS_10'
  | 'D_PLUS_14'

export type MessageStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'blocked_test'
  | 'blocked_window'
  | 'blocked_holiday'
  | 'blocked_duplicate'
  | 'skipped_paid'
  | 'skipped_no_phone'

export interface StageConfig {
  stage: Stage
  dayOffset: number
  label: string
  shortLabel: string
  hasBoleto: boolean
  hasPix: boolean
  tone: string
  description: string
  color: string
}

export interface MessageTemplate {
  stage: Stage
  mainMessage: (vars: TemplateVars) => string
  pixMessage?: (vars: TemplateVars) => string
}

export interface TemplateVars {
  nome: string
  data_vencimento: string
  valor: string
  link_boleto?: string
  codigo_pix?: string
  company_name?: string
  company_whatsapp?: string
}

export interface BillingEngineResult {
  date: string
  testMode: boolean
  stages: {
    stage: Stage
    processed: number
    sent: number
    skipped: number
    errors: number
  }[]
  totalSent: number
  totalSkipped: number
  totalErrors: number
}

export interface SyncResult {
  synced: number
  created: number
  updated: number
  errors: number
}

export interface ConfigMap {
  test_mode: string
  send_window_start: string
  send_window_end: string
  send_days: string
  evolution_instance: string
  sgp_sync_enabled: string
  company_name: string
  company_whatsapp: string
  company_hours: string
}
