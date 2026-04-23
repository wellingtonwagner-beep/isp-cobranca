import axios, { AxiosInstance, AxiosError } from 'axios'

interface EvolutionConfig {
  baseUrl: string
  apiKey: string
  instance: string
}

interface SendTextResponse {
  key: { id: string }
  status: string
}

export class EvolutionClient {
  private http: AxiosInstance
  private instance: string

  constructor(config: EvolutionConfig) {
    this.instance = config.instance
    this.http = axios.create({
      baseURL: config.baseUrl.replace(/\/+$/, ''),
      timeout: 15000,
      headers: {
        'apikey': config.apiKey,
        'Content-Type': 'application/json',
      },
    })
  }

  async sendText(phone: string, text: string): Promise<SendTextResponse> {
    try {
      const res = await this.http.post<SendTextResponse>(`/message/sendText/${this.instance}`, {
        number: phone,
        text,
        delay: 1200,
      })
      return res.data
    } catch (err) {
      throw new Error(extractEvolutionError(err, phone))
    }
  }

  async sendTextWithDelay(phone: string, text: string, delayMs = 2000): Promise<SendTextResponse> {
    await new Promise((r) => setTimeout(r, delayMs))
    return this.sendText(phone, text)
  }

  async checkConnection(): Promise<boolean> {
    try {
      const res = await this.http.get(`/instance/connectionState/${this.instance}`)
      return res.data?.instance?.state === 'open'
    } catch {
      return false
    }
  }

  async getConnectionDetails(): Promise<{ state: string; statusReason?: number }> {
    try {
      const res = await this.http.get(`/instance/connectionState/${this.instance}`)
      return {
        state: res.data?.instance?.state || 'unknown',
        statusReason: res.data?.instance?.statusReason,
      }
    } catch {
      return { state: 'not_found' }
    }
  }

  async restartInstance(): Promise<void> {
    try {
      await this.http.put(`/instance/restart/${this.instance}`)
    } catch {
      // pode falhar se instância não existe
    }
  }

  async logoutInstance(): Promise<void> {
    try {
      await this.http.delete(`/instance/logout/${this.instance}`)
    } catch {
      // pode falhar se instância não existe
    }
  }
}

/**
 * Extrai a mensagem de erro mais útil possível da resposta da Evolution API.
 * A Evolution costuma retornar:
 *   { status, error, message: string | string[] | { exists?: boolean, number?: string }[] }
 * Quando o número não tem WhatsApp, devolve algo como:
 *   { status: 400, message: [{ exists: false, number: '5537...' }] }
 */
function extractEvolutionError(err: unknown, phone: string): string {
  if (!(err instanceof AxiosError)) return err instanceof Error ? err.message : String(err)

  const status = err.response?.status
  const data = err.response?.data as Record<string, unknown> | undefined

  if (!data) {
    if (err.code === 'ECONNABORTED') return 'Timeout ao chamar Evolution API'
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') return 'Servidor da Evolution API inacessível'
    return `${err.code || 'Erro de rede'}: ${err.message}`
  }

  const msg = data.message ?? data.error ?? data.response

  // Caso especial: { message: [{ exists: false, number: '...' }] }
  if (Array.isArray(msg)) {
    const first = msg[0]
    if (first && typeof first === 'object' && 'exists' in first && first.exists === false) {
      return `Número ${phone} não tem WhatsApp ativo`
    }
    const flat = msg.map((m) => typeof m === 'string' ? m : JSON.stringify(m)).join('; ')
    return `Evolution ${status}: ${flat}`
  }

  if (typeof msg === 'string') {
    if (/instance.*not.*connected|state.*close/i.test(msg)) return 'Instância WhatsApp desconectada — refaça o QR Code'
    if (/instance.*not.*found/i.test(msg)) return 'Instância não encontrada na Evolution API'
    if (/exists.*false|not.*exist|not.*registered/i.test(msg)) return `Número ${phone} não tem WhatsApp ativo`
    return `Evolution ${status}: ${msg}`
  }

  if (msg && typeof msg === 'object') {
    return `Evolution ${status}: ${JSON.stringify(msg)}`
  }

  return `Evolution ${status}: erro desconhecido`
}

/**
 * Cria um EvolutionClient a partir das configurações de uma empresa.
 * Retorna null se as credenciais não estiverem configuradas.
 */
export function createEvolutionClient(settings: {
  evolutionBaseUrl?: string | null
  evolutionApiKey?: string | null
  evolutionInstance?: string | null
}): EvolutionClient | null {
  const baseUrl = settings.evolutionBaseUrl || process.env.EVOLUTION_BASE_URL
  const apiKey = settings.evolutionApiKey || process.env.EVOLUTION_API_KEY
  const instance = settings.evolutionInstance || process.env.EVOLUTION_INSTANCE

  if (!baseUrl || !apiKey || !instance) return null

  return new EvolutionClient({ baseUrl, apiKey, instance })
}

// Singleton de fallback para uso sem multi-tenant (compatibilidade)
export const evolution = new EvolutionClient({
  baseUrl: process.env.EVOLUTION_BASE_URL || 'http://localhost:8080',
  apiKey: process.env.EVOLUTION_API_KEY || '',
  instance: process.env.EVOLUTION_INSTANCE || 'default',
})
