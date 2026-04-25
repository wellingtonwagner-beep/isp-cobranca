/**
 * HubSoft API Client
 *
 * Docs: https://docs.hubsoft.com.br/
 *       https://wiki.hubsoft.com.br/pt-br/home
 *
 * Autenticação OAuth2 Password Grant → Bearer token
 * Todos os endpoints usam prefixo /api/v1/integracao/
 */

import axios, { AxiosInstance } from 'axios'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface HubSoftCliente {
  id_cliente: number
  codigo_cliente: number
  nome_razaosocial: string
  nome_fantasia: string | null
  tipo_pessoa: string
  cpf_cnpj: string
  telefone_primario: string | null
  telefone_secundario: string | null
  telefone_terciario: string | null
  email_principal: string | null
  email_secundario: string | null
  data_cadastro: string
  servicos: HubSoftServico[]
}

export interface HubSoftServico {
  id_cliente_servico: number
  numero_plano: number
  nome: string
  valor: number
  status: string
  status_prefixo: string
  tecnologia: string
}

export interface HubSoftFatura {
  id_fatura: number
  uuid_fatura?: string
  quitado: boolean
  status: string // "vencido" | "em_aberto" | "quitado"
  nosso_numero: string
  linha_digitavel: string | null
  codigo_barras: string | null
  pix_copia_cola: string | null
  link: string | null
  tipo_cobranca: string
  valor: number
  valor_pago: number | null
  data_vencimento: string // "DD/MM/YYYY" ou "YYYY-MM-DD"
  data_cadastro: string
  data_pagamento: string | null
  cliente?: {
    codigo_cliente: number
    nome_razaosocial: string
    cpf_cnpj: string
    telefone_primario?: string
    email_principal?: string
  }
}

export interface HubSoftPaginacao {
  primeira_pagina: number
  ultima_pagina: number
  pagina_atual: number
  total_registros: number
}

interface HubSoftConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
  username: string
  password: string
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class HubSoftClient {
  private api: AxiosInstance
  private config: HubSoftConfig
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor(config: HubSoftConfig) {
    this.config = config
    this.api = axios.create({
      baseURL: config.baseUrl.replace(/\/+$/, ''),
      timeout: 180_000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    })
  }

  private async authenticate(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return

    const res = await this.api.post('/oauth/token', {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      username: this.config.username,
      password: this.config.password,
      grant_type: 'password',
    })

    this.accessToken = res.data.access_token
    this.tokenExpiresAt = Date.now() + (res.data.expires_in - 60) * 1000
  }

  private async request<T>(method: 'get' | 'post', path: string, params?: Record<string, string | number>): Promise<T> {
    await this.authenticate()

    const res = await this.api.request<T>({
      method,
      url: `/api/v1/integracao${path}`,
      ...(method === 'get' ? { params } : { data: params }),
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })

    return res.data
  }

  // ── Clientes ────────────────────────────────────────────────────────────

  async getAllClientes(pagina = 0, itensPorPagina = 100): Promise<{ clientes: HubSoftCliente[]; paginacao: HubSoftPaginacao }> {
    const data = await this.request<{
      clientes: HubSoftCliente[]
      paginacao: HubSoftPaginacao
    }>('get', '/cliente/todos', {
      pagina,
      itens_por_pagina: itensPorPagina,
      cancelado: 'nao',
    })
    return data
  }

  async getAllClientesPaginated(): Promise<HubSoftCliente[]> {
    const all: HubSoftCliente[] = []
    let pagina = 0
    const itensPorPagina = 100

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { clientes, paginacao } = await this.getAllClientes(pagina, itensPorPagina)
      all.push(...(clientes || []))

      if (pagina >= paginacao.ultima_pagina) break
      pagina++
    }

    return all
  }

  async searchCliente(busca: string, termo: string): Promise<HubSoftCliente[]> {
    const data = await this.request<{ clientes: HubSoftCliente[] }>('get', '/cliente', {
      busca,
      termo_busca: termo,
      limit: 100,
    })
    return data.clientes || []
  }

  // ── Faturas ─────────────────────────────────────────────────────────────

  async getFaturasPendentes(busca: string, termo: string): Promise<HubSoftFatura[]> {
    const data = await this.request<{ faturas: HubSoftFatura[] }>('get', '/cliente/financeiro', {
      busca,
      termo_busca: termo,
      apenas_pendente: 'sim',
      limit: 50,
      order_by: 'data_vencimento',
      order_type: 'asc',
    })
    return data.faturas || []
  }

  async getFaturasGlobal(
    dataInicio: string,
    dataFim: string,
    pagina = 0,
    itensPorPagina = 200,
  ): Promise<{ faturas: HubSoftFatura[]; paginacao: HubSoftPaginacao }> {
    const data = await this.request<{
      faturas: HubSoftFatura[]
      paginacao: HubSoftPaginacao
    }>('get', '/financeiro/fatura', {
      pagina,
      itens_por_pagina: itensPorPagina,
      data_inicio: dataInicio,
      data_fim: dataFim,
      apenas_em_aberto: 'sim',
      exibir_pix_copia_cola: 'sim',
      tipo_resultado: 'completo',
      tipo_data: 'data_vencimento',
    })
    return data
  }

  async getFaturasGlobalPaginated(dataInicio: string, dataFim: string): Promise<HubSoftFatura[]> {
    const all: HubSoftFatura[] = []
    let pagina = 0
    const itensPorPagina = 200

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { faturas, paginacao } = await this.getFaturasGlobal(dataInicio, dataFim, pagina, itensPorPagina)
      all.push(...(faturas || []))

      if (pagina >= paginacao.ultima_pagina) break
      pagina++
    }

    return all
  }

  async checkInvoicePaid(cpfCnpj: string, idFatura: string): Promise<boolean> {
    try {
      const faturas = await this.getFaturasPendentes('cpf_cnpj', cpfCnpj.replace(/\D/g, ''))
      const fatura = faturas.find((f) => String(f.id_fatura) === idFatura)
      if (!fatura) return true // se não encontrou como pendente, provavelmente foi paga
      return fatura.quitado === true
    } catch {
      return false
    }
  }

  /**
   * Consulta o status atual de uma fatura no HubSoft.
   * A API de pendentes nao retorna canceladas, entao 'not_found' significa
   * que a fatura foi paga, cancelada ou simplesmente nao existe mais — em
   * qualquer caso, nao deve receber cobranca.
   */
  async checkInvoiceStatus(
    cpfCnpj: string,
    idFatura: string,
  ): Promise<'open' | 'paid' | 'cancelled' | 'not_found' | 'unknown'> {
    try {
      const faturas = await this.getFaturasPendentes('cpf_cnpj', cpfCnpj.replace(/\D/g, ''))
      const fatura = faturas.find((f) => String(f.id_fatura) === idFatura)
      if (!fatura) return 'not_found'
      if (fatura.quitado === true) return 'paid'
      return 'open'
    } catch {
      return 'unknown'
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  pickBestPhone(cliente: HubSoftCliente): string | null {
    const phones = [
      cliente.telefone_primario,
      cliente.telefone_secundario,
      cliente.telefone_terciario,
    ].filter(Boolean) as string[]

    // Prioriza celular (9 dígitos após DDD)
    const mobile = phones.find((p) => {
      const digits = p.replace(/\D/g, '')
      return digits.length >= 10 && digits.replace(/^55/, '').charAt(2) === '9'
    })

    return mobile || phones[0] || null
  }

  static parseDate(dateStr: string): string {
    // "DD/MM/YYYY" → "YYYY-MM-DD"
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/')
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    // "YYYY-MM-DD" ou "YYYY-MM-DD HH:mm:ss"
    return dateStr.substring(0, 10)
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHubsoftClient(
  settings: Record<string, unknown>,
): HubSoftClient | null {
  const baseUrl = (settings.hubsoftBaseUrl as string) || ''
  const clientId = (settings.hubsoftClientId as string) || ''
  const clientSecret = (settings.hubsoftClientSecret as string) || ''
  const username = (settings.hubsoftUsername as string) || ''
  const password = (settings.hubsoftPassword as string) || ''

  if (!baseUrl || !clientId || !clientSecret || !username || !password) return null

  return new HubSoftClient({ baseUrl, clientId, clientSecret, username, password })
}
