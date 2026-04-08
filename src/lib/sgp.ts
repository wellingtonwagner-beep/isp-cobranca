import axios, { AxiosInstance } from 'axios'

interface SGPToken {
  access_token: string
  expires_in: number
  expiresAt: number
}

interface SGPClient {
  id_cliente: string | number
  nome: string
  cpf_cnpj?: string
  email?: string
  fone?: string
  celular?: string
  cidade?: string
  status?: string
}

interface SGPInvoice {
  id_fatura: string | number
  id_cliente: string | number
  data_vencimento: string
  valor: number | string
  status: string
  link_boleto?: string
  codigo_pix?: string
}

export class SGPClient_ {
  private http: AxiosInstance
  private token: SGPToken | null = null

  constructor() {
    this.http = axios.create({
      baseURL: process.env.SGP_BASE_URL,
      timeout: Number(process.env.SGP_TIMEOUT_MS) || 30000,
    })
  }

  private async authenticate(): Promise<void> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) return

    const params = new URLSearchParams({
      grant_type: process.env.SGP_GRANT_TYPE || 'password',
      client_id: process.env.SGP_CLIENT_ID || '',
      client_secret: process.env.SGP_CLIENT_SECRET || '',
      username: process.env.SGP_USERNAME || '',
      password: process.env.SGP_PASSWORD || '',
    })

    const res = await this.http.post('/oauth/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    this.token = {
      access_token: res.data.access_token,
      expires_in: res.data.expires_in,
      expiresAt: Date.now() + res.data.expires_in * 1000,
    }
  }

  private async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    await this.authenticate()
    const res = await this.http.get<T>(url, {
      params,
      headers: { Authorization: `Bearer ${this.token!.access_token}` },
    })
    return res.data
  }

  async getAllClients(): Promise<SGPClient[]> {
    const clientsUrl = process.env.SGP_CLIENTS_URL || '/api/v1/integracao/cliente/todos'
    const allClients: SGPClient[] = []
    let page = 1
    const pageSize = 200

    while (true) {
      const data = await this.get<{ clientes?: SGPClient[]; data?: SGPClient[] }>(clientsUrl, {
        pagina: page,
        itens_por_pagina: pageSize,
      })

      const clients = data.clientes || data.data || []
      allClients.push(...clients)

      if (clients.length < pageSize) break
      if (page > 1000) break // safety cap
      page++
    }

    return allClients
  }

  async getOpenInvoices(fromDate?: string): Promise<SGPInvoice[]> {
    const invoicesUrl = process.env.SGP_INVOICES_URL || '/api/v1/integracao/financeiro/faturas'
    const params: Record<string, unknown> = { status: 'aberta' }
    if (fromDate) params.data_inicio = fromDate

    const data = await this.get<{ faturas?: SGPInvoice[]; data?: SGPInvoice[] }>(invoicesUrl, params)
    return data.faturas || data.data || []
  }

  async getInvoiceById(invoiceId: string): Promise<SGPInvoice | null> {
    try {
      const invoicesUrl = process.env.SGP_INVOICES_URL || '/api/v1/integracao/financeiro/faturas'
      const data = await this.get<{ fatura?: SGPInvoice; data?: SGPInvoice }>(`${invoicesUrl}/${invoiceId}`)
      return data.fatura || data.data || null
    } catch {
      return null
    }
  }

  async getHolidays(year: number): Promise<{ data: string; descricao: string }[]> {
    try {
      const holidaysUrl = process.env.SGP_HOLIDAYS_URL || '/api/v1/integracao/feriados'
      const data = await this.get<{ feriados?: { data: string; descricao: string }[] }>(holidaysUrl, { ano: year })
      return data.feriados || []
    } catch {
      return []
    }
  }
}

export const sgp = new SGPClient_()
