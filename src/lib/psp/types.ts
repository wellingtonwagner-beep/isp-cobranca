/**
 * Interface comum para PSPs (Provedores de Servicos de Pagamento) PIX.
 *
 * Implementacoes seguem o padrao Bacen API PIX (cobranca imediata + webhook).
 * Adapters concretos: c6-pix.ts (futuramente: sicoob, asaas, mercadopago).
 *
 * Idempotencia: TXID e' gerado pelo nosso lado (1 por Invoice). PUT /cob/{txid}
 * permite criar/sobrescrever sem duplicar.
 */

export type PspProvider = 'c6' | 'sicoob' | 'asaas' | 'mercadopago' | 'bb' | 'inter' | 'gerencianet'

export type PspEnv = 'sandbox' | 'production'

export interface PSPCredentials {
  provider: PspProvider
  env: PspEnv
  baseUrl?: string         // override de URL (sandbox/prod)
  clientId: string
  clientSecret: string
  apiKey?: string          // alguns PSPs usam api key alem de OAuth
  certBase64?: string      // certificado mTLS .pfx em base64 (C6, Sicoob, BB)
  certPassword?: string    // senha do .pfx
  webhookSecret: string    // gerado por nos, parte da URL do webhook
}

export interface CreateChargeInput {
  txid: string                    // unico, 26-35 chars alfanumericos (gerado pelo caller)
  amount: number                  // valor em reais (R$)
  description?: string            // texto exibido pro pagador
  payerCpfCnpj?: string
  payerName?: string
  expiresIn?: number              // segundos. Default: 86400 (24h)
  pixKey: string                  // chave PIX recebedora (CNPJ/email/aleatoria)
  beneficiaryName: string
  beneficiaryCity: string
}

export interface CreateChargeOutput {
  txid: string
  status: PspChargeStatus
  pixCopiaCola: string            // brstring para QR Code
  qrCodeImageBase64?: string      // imagem PNG opcional (alguns PSPs retornam)
  expiresAt: Date
  rawResponse?: unknown           // resposta crua do PSP (debug/log)
}

export type PspChargeStatus = 'ATIVA' | 'CONCLUIDA' | 'REMOVIDA_PELO_USUARIO_RECEBEDOR' | 'REMOVIDA_PELO_PSP'

export interface GetChargeOutput {
  txid: string
  status: PspChargeStatus
  paid: boolean
  paidAt?: Date
  paidValue?: number
  e2eId?: string                  // EndToEndId Bacen
  payerCpfCnpj?: string
  payerName?: string
}

export interface WebhookPaymentEvent {
  txid: string
  e2eId: string
  paidAt: Date
  paidValue: number
  payerCpfCnpj?: string
  payerName?: string
}

export interface PSPClient {
  readonly provider: PspProvider
  readonly env: PspEnv

  /**
   * Tenta autenticar e fazer um request basico. Retorna detalhes do erro
   * para diagnostico na tela de Configuracoes.
   */
  testConnection(): Promise<{ ok: boolean; message: string }>

  /**
   * Cria uma cobranca imediata com o TXID informado. Idempotente:
   * chamar 2x com mesmo txid retorna a mesma cobranca.
   */
  createCharge(input: CreateChargeInput): Promise<CreateChargeOutput>

  /**
   * Consulta o status atual de uma cobranca pelo TXID.
   */
  getCharge(txid: string): Promise<GetChargeOutput>

  /**
   * Parseia o body do webhook (formato pode variar por PSP).
   * Retorna lista pq alguns PSPs mandam batch de eventos.
   */
  parseWebhook(body: unknown): WebhookPaymentEvent[]
}

/**
 * Helper para gerar TXID valido (26 chars hex maiusculos).
 * TXID deve ter 26-35 chars alfanumericos no padrao Bacen.
 */
export function generateTxid(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 26).toUpperCase()
}
