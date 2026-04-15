import axios, { AxiosInstance } from 'axios'

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
    const res = await this.http.post<SendTextResponse>(`/message/sendText/${this.instance}`, {
      number: phone,
      text,
      delay: 1200,
    })
    return res.data
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
