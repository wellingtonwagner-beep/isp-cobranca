import axios, { AxiosInstance } from 'axios'

interface SendTextResponse {
  key: { id: string }
  status: string
}

export class EvolutionClient {
  private http: AxiosInstance

  constructor() {
    this.http = axios.create({
      baseURL: process.env.EVOLUTION_BASE_URL || 'http://localhost:8080',
      timeout: 15000,
      headers: {
        'apikey': process.env.EVOLUTION_API_KEY || '',
        'Content-Type': 'application/json',
      },
    })
  }

  private getInstance(): string {
    return process.env.EVOLUTION_INSTANCE || 'default'
  }

  async sendText(phone: string, text: string): Promise<SendTextResponse> {
    const instance = this.getInstance()
    const res = await this.http.post<SendTextResponse>(`/message/sendText/${instance}`, {
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
      const instance = this.getInstance()
      const res = await this.http.get(`/instance/connectionState/${instance}`)
      return res.data?.instance?.state === 'open'
    } catch {
      return false
    }
  }
}

export const evolution = new EvolutionClient()
