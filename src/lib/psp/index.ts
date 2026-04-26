/**
 * Factory para criar PSPClient a partir das settings da empresa.
 * Centraliza a escolha do adapter por provider.
 */
import { C6PixClient } from './c6-pix'
import type { PSPClient, PSPCredentials, PspEnv, PspProvider } from './types'

export type { PSPClient, PSPCredentials, CreateChargeInput, CreateChargeOutput, GetChargeOutput, WebhookPaymentEvent } from './types'
export { generateTxid } from './types'

export interface PspSettings {
  pixPsp?: string | null
  pixPspApiKey?: string | null
  pixPspClientId?: string | null
  pixPspClientSecret?: string | null
  pixPspWebhookSecret?: string | null
  pixPspBaseUrl?: string | null
  pixPspEnv?: string | null
  pixPspCertBase64?: string | null
  pixPspCertPassword?: string | null
}

export function createPspClient(settings: PspSettings): PSPClient | null {
  const provider = (settings.pixPsp || '').toLowerCase() as PspProvider
  if (!provider) return null
  if (!settings.pixPspClientId || !settings.pixPspClientSecret) return null

  const env: PspEnv = (settings.pixPspEnv === 'production' ? 'production' : 'sandbox')
  const creds: PSPCredentials = {
    provider,
    env,
    baseUrl: settings.pixPspBaseUrl || undefined,
    clientId: settings.pixPspClientId,
    clientSecret: settings.pixPspClientSecret,
    apiKey: settings.pixPspApiKey || undefined,
    certBase64: settings.pixPspCertBase64 || undefined,
    certPassword: settings.pixPspCertPassword || undefined,
    webhookSecret: settings.pixPspWebhookSecret || '',
  }

  switch (provider) {
    case 'c6':
      return new C6PixClient(creds)
    default:
      // Outros adapters virao aqui (asaas, sicoob, etc).
      // Por enquanto retornamos null para evitar erro silencioso.
      return null
  }
}
