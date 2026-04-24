import cron from 'node-cron'
import axios from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET || 'troque-em-producao-123'

async function callApi(path: string, method: 'POST' | 'GET' = 'POST') {
  try {
    const res = await axios({
      method,
      url: `${BASE_URL}${path}`,
      headers: { 'x-cron-secret': CRON_SECRET },
      timeout: 120_000,
    })
    console.log(`[Cron] ${path} → ${res.status}`, res.data?.result || '')
  } catch (err: unknown) {
    const error = err as { message?: string; response?: { status: number; data: unknown } }
    console.error(`[Cron] Erro em ${path}:`, error?.response?.data || error?.message)
  }
}

// ── Sincronização diária (6:30 e 6:45, Seg-Sáb) ──────────────────────────
cron.schedule('30 6 * * 1-6', async () => {
  console.log('[Cron] Sincronizando clientes...')
  await callApi('/api/sync/clientes')
})

cron.schedule('45 6 * * 1-6', async () => {
  console.log('[Cron] Sincronizando faturas...')
  await callApi('/api/sync/faturas')
})

// ── Meia-noite: sync de faturas para pegar novos vencimentos ─────────────
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Sync noturno de faturas...')
  await callApi('/api/sync/faturas')
})

// ── 00:15 todo dia: gera faturas das assinaturas (banco proprio) ─────────
cron.schedule('15 0 * * *', async () => {
  console.log('[Cron] Gerando faturas de assinaturas...')
  await callApi('/api/subscriptions/generate')
})

// ── Disparo de cobranças: todo início de hora, 8h-20h, Seg-Sáb ───────────
cron.schedule('0 8,9,10,11,12,13,14,15,16,17,18,19,20 * * 1-6', async () => {
  console.log('[Cron] Executando billing engine...')
  await callApi('/api/cron')
})

console.log('[Cron] Servidor de agendamento iniciado.')
console.log('[Cron] Schedules ativos:')
console.log('  - Sync clientes:        06:30 Seg-Sáb')
console.log('  - Sync faturas:         06:45 Seg-Sáb + meia-noite')
console.log('  - Assinaturas manuais:  00:15 todos os dias (gera mensalidades)')
console.log('  - Billing engine:       8h-20h todo início de hora, Seg-Sáb')
