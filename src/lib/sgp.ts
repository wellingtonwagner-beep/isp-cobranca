/**
 * SGP TSMX API Client
 *
 * Docs: https://documenter.getpostman.com/view/6682240/2sB34hHg2V
 *
 * Dois tipos de endpoint com autenticação diferente:
 *   - URA   → POST com JSON body  (token + app no JSON)
 *   - Central → POST com multipart/form-data (token + app no form)
 */

// ---------------------------------------------------------------------------
// Tipos — URA (/api/ura/clientes/)
// ---------------------------------------------------------------------------

export interface SGPURAFatura {
  id: number
  cliente_id: number
  clientecontrato_id: number
  portador: string
  numeroDocumento: number
  nossoNumero: string
  status: string          // "aberto" | "pago" | "cancelado"
  valor: number
  valorJuros: number
  valorMulta: number
  valorDesconto: number
  valorCorrigido: number
  valorPago: number | string
  jurosDia: number
  multaDia: number
  diasAtraso: number      // dias em atraso (0 = no prazo ou futuro)
  codigoBarras: string
  linhaDigitavel: string
  codigoPix: string
  link: string            // URL completa do boleto (ex: "https://wcp.sgp.net.br/boleto/16405-ABC/")
  dataEmissao: string     // "AAAA-MM-DD"
  dataVencimento: string  // "AAAA-MM-DD"
  dataPagamento: string
  dataCancelamento: string
  demonstrativo: string
  formaPagamento: string
}

export interface SGPURAContrato {
  contrato: number
  dataCadastro: string
  status: string
  motivo_status: string   // ex: "Financeiro" → contrato bloqueado por inadimplência
}

export interface SGPURACliente {
  nome: string
  cpfcnpj: string
  dataCadastro: string
  tipo: string
  observacao_cliente: string
  endereco: {
    logradouro: string
    numero: number
    bairro: string
    cidade: string
    uf: string
    cep: string
    complemento: string
    latitude: string
    longitude: string
  }
  contratos: SGPURAContrato[]
  titulos: SGPURAFatura[]
}

interface SGPURAClientesResponse {
  paginacao: {
    offset: number
    limit: number
    parcial: number
    total: number
  }
  clientes: SGPURACliente[]
}

// ---------------------------------------------------------------------------
// Tipos — Central (/api/central/titulos/)
// ---------------------------------------------------------------------------

export interface SGPFatura {
  id: number
  numero_documento: number
  vencimento: string           // "AAAA-MM-DD"
  vencimento_atualizado: string
  status: string               // "Gerado" | "Pago" | "Cancelado"
  statusid: number             // 1=Em aberto | 2=Pago | 3=Cancelado
  valor: number
  valorcorrigido: number
  link: string                 // path relativo: "/empresa/boleto/12345-TOKEN/"
  codigopix: string
  gerarpix: boolean
  linhadigitavel: string
  data_pagamento: string | null
}

interface SGPCentralFaturasResponse {
  paginacao: {
    offset: number
    limit: number
    parcial: number
    total: number
  }
  faturas: SGPFatura[]
}

// ---------------------------------------------------------------------------
// Tipos — Cliente Detalhes (/api/ura/consultacliente/)
// ---------------------------------------------------------------------------

export interface SGPClienteDetalhes {
  clienteId: number
  cpfCnpj: string
  razaoSocial: string
  contratoId: number
  contratoStatus: number          // 1=Ativo 2=Inativo 3=Cancelado 4=Suspenso...
  contratoStatusDisplay: string
  motivo_status: string
  planointernet: string
  telefones: string[]             // ex: ["(44) 99999-9999"]
  telefones_cargos: Array<{       // contato adicional com cargo
    cargo: string | null
    contato: string               // ex: "(44) 9999-9999"
    nome: string | null
  }>
  emails: string[]
  endereco_cidade: string
  endereco_uf: string
  endereco_cep: string
  dataNascimento: string
  observacao_cliente: string
  contratoValorAberto: number     // valor total em aberto
  contratoTitulosAReceber: number // número de títulos a receber
}

// ---------------------------------------------------------------------------
// Filtros para getAllClientes()
// ---------------------------------------------------------------------------

export interface SGPClientesFiltros {
  /** Filtrar títulos por status: "aberto" | "pago" | "cancelado" */
  status?: 'aberto' | 'pago' | 'cancelado'
  /** Filtrar por status do contrato: 1=Ativo 2=Inativo 3=Cancelado 4=Suspenso 5=Inviabilidade 6=Novo 7=Ativo V.Reduzia */
  contrato_status?: number
  /** Vencimento inicial dos títulos (AAAA-MM-DD) */
  data_vencimento_inicio?: string
  /** Vencimento final dos títulos (AAAA-MM-DD) */
  data_vencimento_fim?: string
  /** Início do pagamento (AAAA-MM-DD) */
  data_pagamento_inicio?: string
  /** ID do cliente específico */
  cliente_id?: number
  /** CPF/CNPJ do cliente */
  cpfcnpj?: string
  /** Nome/razão social */
  cliente_nome?: string
  /** Plano dos serviços */
  plano?: number
  /** Login do serviço de internet */
  login?: string
}

// ---------------------------------------------------------------------------
// Cliente SGP
// ---------------------------------------------------------------------------

interface SGPConfig {
  baseUrl: string
  token: string
  app: string
  timeout?: number
}

export class SGPClient_ {
  private baseUrl: string
  private token: string
  private app: string
  private timeout: number

  constructor(config?: SGPConfig) {
    this.baseUrl = (config?.baseUrl || process.env.SGP_BASE_URL || '').replace(/\/$/, '')
    this.token   = config?.token || process.env.SGP_TOKEN || ''
    this.app     = config?.app   || process.env.SGP_APP   || ''
    this.timeout = config?.timeout ?? 180_000 // 3 minutos — ignora SGP_TIMEOUT_MS
  }

  /**
   * URA: POST com JSON body.
   * Token e App vão no JSON.
   */
  private async postJSON<T>(
    path: string,
    body: Record<string, unknown> = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const payload = { app: this.app, token: this.token, ...body }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!res.ok) {
      throw new Error(`SGP URA error ${res.status} em ${path}: ${await res.text()}`)
    }
    return res.json() as Promise<T>
  }

  /**
   * Central: POST com multipart/form-data.
   * Token e App vão no form.
   */
  private async postForm<T>(
    path: string,
    extra: Record<string, string | number | undefined | null> = {},
  ): Promise<T> {
    const url  = `${this.baseUrl}${path}`
    const form = new FormData()
    form.append('token', this.token)
    form.append('app', this.app)
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== null && v !== '') {
        form.append(k, String(v))
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!res.ok) {
      throw new Error(`SGP Central error ${res.status} em ${path}: ${await res.text()}`)
    }
    return res.json() as Promise<T>
  }

  // ---------------------------------------------------------------------------
  // URA — Clientes
  // POST /api/ura/clientes/
  // Retorna clientes com contratos e títulos (faturas) embutidos.
  // ---------------------------------------------------------------------------

  /**
   * Lista todos os clientes (com paginação automática).
   * Retorna clientes com seus contratos e títulos (faturas) já embutidos.
   *
   * @param filtros Filtros opcionais: status de fatura, data de vencimento, etc.
   */
  async getAllClientes(filtros: SGPClientesFiltros = {}): Promise<SGPURACliente[]> {
    const path   = process.env.SGP_URA_CLIENTES_URL || '/api/ura/clientes/'
    const all: SGPURACliente[] = []
    let offset   = 0
    const limit  = 100

    while (true) {
      const data = await this.postJSON<SGPURAClientesResponse>(path, {
        ...filtros,
        offset,
        limit,
      })

      const clientes = data.clientes || []
      all.push(...clientes)

      const total = data.paginacao?.total ?? 0
      if (all.length >= total || clientes.length < limit) break
      offset += limit
    }

    return all
  }

  /**
   * Atalho: clientes com faturas em aberto.
   * Útil para sync diário — retorna somente quem tem algo a receber.
   */
  async getClientesComFaturaAberta(): Promise<SGPURACliente[]> {
    return this.getAllClientes({ status: 'aberto' })
  }

  /**
   * Atalho: clientes com faturas vencendo em um intervalo de datas.
   * @param inicio "AAAA-MM-DD"
   * @param fim    "AAAA-MM-DD"
   */
  async getClientesPorVencimento(inicio: string, fim: string): Promise<SGPURACliente[]> {
    return this.getAllClientes({
      status: 'aberto',
      data_vencimento_inicio: inicio,
      data_vencimento_fim: fim,
    })
  }

  // ---------------------------------------------------------------------------
  // Central — Faturas por cliente
  // POST /api/central/titulos/
  // Aceita token+app (admin) OU cpfcnpj+senha (cliente).
  // Útil para validar pagamento em tempo real de um cliente específico.
  // ---------------------------------------------------------------------------

  /**
   * Lista faturas de um cliente pelo CPF/CNPJ (autenticação admin via token+app).
   * @param cpfcnpj  CPF ou CNPJ do cliente
   * @param statusId 1=Em aberto | 2=Pago | 3=Cancelado | undefined=1 e 2
   * @param contrato ID do contrato (opcional)
   */
  async getFaturasByCliente(
    cpfcnpj: string,
    statusId?: 1 | 2 | 3,
    contrato?: number,
  ): Promise<SGPFatura[]> {
    const path  = process.env.SGP_TITULOS_URL || '/api/central/titulos/'
    const all: SGPFatura[] = []
    let offset  = 0
    const limit = 250

    while (true) {
      const data = await this.postForm<SGPCentralFaturasResponse>(path, {
        cpfcnpj,
        status:   statusId,
        contrato,
        offset,
        limit,
      })

      const faturas = data.faturas || []
      all.push(...faturas)

      const total = data.paginacao?.total ?? 0
      if (all.length >= total || faturas.length < limit) break
      offset += limit
    }

    return all
  }

  /**
   * Verifica se uma fatura específica já foi paga diretamente no SGP.
   * Usado pelo billing engine no estágio D_ZERO (dia do vencimento).
   * @returns true se statusid === 2 (Pago)
   */
  async checkInvoicePaid(cpfcnpj: string, invoiceId: string): Promise<boolean> {
    try {
      const faturas = await this.getFaturasByCliente(cpfcnpj)
      const fatura  = faturas.find(
        f => String(f.id) === invoiceId || String(f.numero_documento) === invoiceId,
      )
      return fatura?.statusid === 2
    } catch {
      return false
    }
  }

  /**
   * Consulta o status atual de uma fatura no SGP.
   * Usado pelo billing engine para validar antes de cobrar e pelo sync
   * para reconciliar status local com remoto.
   *
   * Retorna 'unknown' em caso de erro de rede para o caller decidir (fail-safe).
   * Retorna 'not_found' quando a fatura nao aparece em nenhum status pesquisado.
   */
  async checkInvoiceStatus(
    cpfcnpj: string,
    invoiceId: string,
  ): Promise<'open' | 'paid' | 'cancelled' | 'not_found' | 'unknown'> {
    try {
      // Sem statusId: retorna abertas (1) e pagas (2)
      const faturas = await this.getFaturasByCliente(cpfcnpj)
      const fatura = faturas.find(
        f => String(f.id) === invoiceId || String(f.numero_documento) === invoiceId,
      )
      if (fatura) {
        if (fatura.statusid === 1) return 'open'
        if (fatura.statusid === 2) return 'paid'
        if (fatura.statusid === 3) return 'cancelled'
      }
      // Nao apareceu em abertas/pagas — checa canceladas explicitamente
      const canceladas = await this.getFaturasByCliente(cpfcnpj, 3)
      const cancel = canceladas.find(
        f => String(f.id) === invoiceId || String(f.numero_documento) === invoiceId,
      )
      if (cancel) return 'cancelled'
      return 'not_found'
    } catch {
      return 'unknown'
    }
  }

  // ---------------------------------------------------------------------------
  // URA — Detalhes de um cliente específico
  // POST /api/ura/consultacliente/
  // Retorna dados completos incluindo telefones e e-mails.
  // Nota: usa --form (multipart/form-data), igual aos endpoints Central.
  // ---------------------------------------------------------------------------

  /**
   * Consulta dados detalhados de um cliente pelo CPF/CNPJ.
   * Retorna telefones, e-mails e informações completas do contrato.
   * Use para enriquecer o cadastro local após o sync inicial.
   */
  async getClienteDetalhes(cpfcnpj: string): Promise<SGPClienteDetalhes | null> {
    const path = process.env.SGP_CONSULTA_CLIENTE_URL || '/api/ura/consultacliente/'
    try {
      const data = await this.postForm<{ msg: string; contratos: SGPClienteDetalhes[] }>(
        path,
        { cpfcnpj },
      )
      return data.contratos?.[0] ?? null
    } catch {
      return null
    }
  }

  /**
   * Extrai o melhor número de telefone para WhatsApp de um SGPClienteDetalhes.
   * Preferência: número com 9 dígitos (celular) antes de fixo (8 dígitos).
   * Retorna null se nenhum número válido for encontrado.
   */
  pickBestPhone(detalhes: SGPClienteDetalhes): string | null {
    const candidates: string[] = [
      ...(detalhes.telefones ?? []),
      ...(detalhes.telefones_cargos ?? []).map(t => t.contato),
    ].filter(Boolean)

    // Prefere números com 11 dígitos (55 + DDD + 9 + 8 dígitos = celular)
    const sorted = candidates.sort((a, b) => {
      const da = a.replace(/\D/g, '').length
      const db = b.replace(/\D/g, '').length
      return db - da // maior número de dígitos primeiro
    })

    return sorted[0] ?? null
  }

  // ---------------------------------------------------------------------------

  /**
   * Monta a URL completa do boleto a partir do path relativo retornado pela API.
   * Ex: link = "/empresa/boleto/12345-ABC/" → "https://suaempresa.sgp.net.br/empresa/boleto/12345-ABC/"
   */
  boletoUrl(link: string): string {
    if (!link) return ''
    return `${this.baseUrl}${link}`
  }
}

/**
 * Cria um SGPClient a partir das configurações de uma empresa.
 * Retorna null se as credenciais não estiverem configuradas.
 */
export function createSgpClient(settings: {
  sgpBaseUrl?: string | null
  sgpToken?: string | null
  sgpApp?: string | null
}): SGPClient_ | null {
  const baseUrl = settings.sgpBaseUrl || process.env.SGP_BASE_URL
  const token = settings.sgpToken || process.env.SGP_TOKEN
  const app = settings.sgpApp || process.env.SGP_APP

  if (!baseUrl || !token || !app) return null

  return new SGPClient_({ baseUrl, token, app })
}

// Singleton de fallback para uso sem multi-tenant (compatibilidade)
export const sgp = new SGPClient_()
