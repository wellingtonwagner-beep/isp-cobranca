import cron from 'node-cron'
import axios from 'axios'

// Cron-server e Next rodam no MESMO container (via concurrently).
// Chamar localhost evita problemas de DNS/SSL/firewall quando a URL publica
// passa por proxy reverso. Para override explicito, use INTERNAL_APP_URL.
const BASE_URL = process.env.INTERNAL_APP_URL || 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET || 'troque-em-producao-123'

function nowStr() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

async function callApi(path: string, method: 'POST' | 'GET' = 'POST') {
  const started = Date.now()
  console.log(`[Cron ${nowStr()}] → ${method} ${path}`)
  try {
    const res = await axios({
      method,
      url: `${BASE_URL}${path}`,
      headers: { 'x-cron-secret': CRON_SECRET },
      timeout: 120_000,
    })
    const ms = Date.now() - started
    const summary = typeof res.data === 'object' ? JSON.stringify(res.data).slice(0, 300) : ''
    console.log(`[Cron ${nowStr()}] ← ${res.status} ${path} (${ms}ms) ${summary}`)
  } catch (err: unknown) {
    const ms = Date.now() - started
    const error = err as { code?: string; message?: string; response?: { status: number; data: unknown } }
    console.error(
      `[Cron ${nowStr()}] X ${path} (${ms}ms)`,
      error?.response?.status || error?.code || '',
      error?.response?.data || error?.message,
    )
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

// ── Pre-sync 5min antes de cada disparo: garante estado fresco do ERP ────
// Roda 7:55, 8:55, ..., 19:55 (Seg-Sáb) → billing engine logo a seguir.
cron.schedule('55 7,8,9,10,11,12,13,14,15,16,17,18,19 * * 1-6', async () => {
  console.log('[Cron] Pre-sync de faturas (antes do billing)...')
  await callApi('/api/sync/faturas')
})

// ── Disparo de cobranças: todo início de hora, 8h-20h, Seg-Sáb ───────────
cron.schedule('0 8,9,10,11,12,13,14,15,16,17,18,19,20 * * 1-6', async () => {
  console.log('[Cron] Executando billing engine...')
  await callApi('/api/cron')
})

console.log(`[Cron ${nowStr()}] Servidor de agendamento iniciado.`)
console.log(`[Cron] BASE_URL = ${BASE_URL}`)
console.log(`[Cron] CRON_SECRET = ${CRON_SECRET ? '***' + CRON_SECRET.slice(-4) : '(vazio)'}`)
console.log(`[Cron] Timezone = ${process.env.TZ || 'UTC (default)'}`)
console.log('[Cron] Schedules ativos:')
console.log('  - Sync clientes:        06:30 Seg-Sáb')
console.log('  - Sync faturas:         06:45 Seg-Sáb + meia-noite + pre-sync 7:55-19:55 Seg-Sáb')
console.log('  - Assinaturas manuais:  00:15 todos os dias (gera mensalidades)')
console.log('  - Billing engine:       8h-20h todo início de hora, Seg-Sáb')
