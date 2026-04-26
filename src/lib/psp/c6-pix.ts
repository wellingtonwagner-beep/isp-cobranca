/**
 * Adapter C6 Bank PIX (cobranca imediata + webhook), padrao Bacen.
 *
 * Autenticacao: OAuth2 client_credentials + mTLS (.pfx).
 * Endpoints: PUT /cob/{txid}, GET /cob/{txid}, POST /webhook/{chave}.
 *
 * URLs default sao placeholders — o usuario deve colar a URL real
 * fornecida pelo C6 na homologacao em CompanySettings.pixPspBaseUrl.
 *
 * Sandbox testavel sem cert real (nao chamara API), mas qualquer chamada
 * de producao FALHA sem cert mTLS valido.
 */
import axios, { AxiosInstance } from 'axios'
import { Agent } from 'https'
import type {
  CreateChargeInput, CreateChargeOutput, GetChargeOutput,
  PSPClient, PSPCredentials, PspChargeStatus, WebhookPaymentEvent,
} from './types'

// URLs default — sobrescreva via CompanySettings.pixPspBaseUrl
const DEFAULT_BASE_URLS = {
  sandbox: 'https://baas-h.c6bank.com.br',  // homologacao
  production: 'https://baas.c6bank.com.br', // producao
}

interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface CobResponse {
  txid: string
  status: PspChargeStatus
  valor: { original: string }
  calendario: { criacao: string; expiracao: number }
  pixCopiaECola?: string
  qrcode?: string
  pix?: Array<{
    endToEndId: string
    txid: string
    valor: string
    horario: string
    infoPagador?: string
    pagador?: { cpf?: string; cnpj?: string; nome?: string }
  }>
}

export class C6PixClient implements PSPClient {
  readonly provider = 'c6' as const
  readonly env: 'sandbox' | 'production'

  private baseUrl: string
  private clientId: string
  private clientSecret: string
  private api: AxiosInstance
  private accessToken: string | null = null
  private tokenExpiresAt = 0

  constructor(creds: PSPCredentials) {
    if (creds.provider !== 'c6') {
      throw new Error(`C6PixClient recebeu provider ${creds.provider}`)
    }
    this.env = creds.env
    this.baseUrl = (creds.baseUrl || DEFAULT_BASE_URLS[creds.env]).replace(/\/+$/, '')
    this.clientId = creds.clientId
    this.clientSecret = creds.clientSecret

    // mTLS: carrega o certificado .pfx + senha. Sem cert, requests vao falhar
    // em producao mas permitem que objeto seja construido (testes locais).
    let httpsAgent: Agent | undefined
    if (creds.certBase64) {
      try {
        const pfx = Buffer.from(creds.certBase64, 'base64')
        httpsAgent = new Agent({
          pfx,
          passphrase: creds.certPassword || undefined,
        })
      } catch (err) {
        console.warn('[C6PixClient] Falha ao carregar certificado mTLS:', err)
      }
    }

    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(httpsAgent ? { httpsAgent } : {}),
      validateStatus: () => true, // tratamos status manualmente para mensagens claras
    })
  }

  private async ensureToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }
    const credsB64 = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
    const res = await this.api.post('/oauth/token', 'grant_type=client_credentials&scope=cob.write%20cob.read%20pix.read%20webhook.read%20webhook.write', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credsB64}`,
      },
    })
    if (res.status >= 400) {
      throw new Error(`C6 OAuth ${res.status}: ${JSON.stringify(res.data)}`)
    }
    const data = res.data as OAuthTokenResponse
    this.accessToken = data.access_token
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000
    return this.accessToken
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.ensureToken()
      return { ok: true, message: `Conectado ao C6 (${this.env}). Token OAuth obtido com sucesso.` }
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string }
      return { ok: false, message: e.message || e.code || 'Erro desconhecido' }
    }
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeOutput> {
    const token = await this.ensureToken()
    const body = {
      calendario: { expiracao: input.expiresIn ?? 86400 },
      ...(input.payerCpfCnpj
        ? {
            devedor: input.payerCpfCnpj.length === 11
              ? { cpf: input.payerCpfCnpj, nome: input.payerName || '' }
              : { cnpj: input.payerCpfCnpj, nome: input.payerName || '' },
          }
        : {}),
      valor: { original: input.amount.toFixed(2) },
      chave: input.pixKey,
      ...(input.description ? { solicitacaoPagador: input.description.slice(0, 140) } : {}),
    }

    const res = await this.api.put(`/pix/v2/cob/${input.txid}`, body, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status >= 400) {
      throw new Error(`C6 createCharge ${res.status}: ${JSON.stringify(res.data)}`)
    }
    const data = res.data as CobResponse
    const expiracao = data.calendario?.expiracao ?? input.expiresIn ?? 86400
    const criacao = data.calendario?.criacao ? new Date(data.calendario.criacao) : new Date()

    return {
      txid: data.txid || input.txid,
      status: data.status || 'ATIVA',
      pixCopiaCola: data.pixCopiaECola || data.qrcode || '',
      expiresAt: new Date(criacao.getTime() + expiracao * 1000),
      rawResponse: data,
    }
  }

  async getCharge(txid: string): Promise<GetChargeOutput> {
    const token = await this.ensureToken()
    const res = await this.api.get(`/pix/v2/cob/${txid}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status >= 400) {
      throw new Error(`C6 getCharge ${res.status}: ${JSON.stringify(res.data)}`)
    }
    const data = res.data as CobResponse
    const pago = data.pix?.[0]
    return {
      txid: data.txid,
      status: data.status,
      paid: data.status === 'CONCLUIDA',
      paidAt: pago?.horario ? new Date(pago.horario) : undefined,
      paidValue: pago?.valor ? Number(pago.valor) : undefined,
      e2eId: pago?.endToEndId,
      payerCpfCnpj: pago?.pagador?.cpf || pago?.pagador?.cnpj,
      payerName: pago?.pagador?.nome,
    }
  }

  /**
   * Webhook do C6 segue padrao Bacen: body contem array `pix` com eventos
   * de credito. Cada evento aponta para o txid da cobranca paga.
   */
  parseWebhook(body: unknown): WebhookPaymentEvent[] {
    const data = body as { pix?: Array<{
      endToEndId: string
      txid: string
      valor: string
      horario: string
      pagador?: { cpf?: string; cnpj?: string; nome?: string }
    }> }
    if (!data?.pix || !Array.isArray(data.pix)) return []
    return data.pix
      .filter((p) => p.txid && p.endToEndId)
      .map((p) => ({
        txid: p.txid,
        e2eId: p.endToEndId,
        paidAt: new Date(p.horario),
        paidValue: Number(p.valor),
        payerCpfCnpj: p.pagador?.cpf || p.pagador?.cnpj,
        payerName: p.pagador?.nome,
      }))
  }
}
