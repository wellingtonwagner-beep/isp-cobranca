/**
 * GET /api/admin/cron-test
 * Diagnostica se o cron-server consegue chamar a API interna.
 * Testa chamando /api/cron (POST) e /api/sync/faturas (POST) com o CRON_SECRET.
 * Retorna status+tempo de cada chamada.
 *
 * Acesso: super-admin.
 */
import { NextResponse } from 'next/server'
import axios from 'axios'
import { getAdminSessionFromCookie } from '@/lib/admin-jwt'

export async function GET() {
  const session = await getAdminSessionFromCookie()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const baseUrl = process.env.INTERNAL_APP_URL || 'http://localhost:3000'
  const secret = process.env.CRON_SECRET

  const targets = ['/api/cron', '/api/sync/faturas', '/api/sync/clientes', '/api/subscriptions/generate']
  const results: { path: string; ok: boolean; status?: number; timeMs: number; note?: string }[] = []

  for (const path of targets) {
    const started = Date.now()
    try {
      const res = await axios.post(`${baseUrl}${path}`, {}, {
        headers: { 'x-cron-secret': secret || '' },
        timeout: 15_000,
        validateStatus: () => true, // queremos o status real
      })
      results.push({
        path,
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        timeMs: Date.now() - started,
        note: res.status === 401 ? 'CRON_SECRET incorreto' : undefined,
      })
    } catch (err) {
      const e = err as { code?: string; message?: string }
      results.push({
        path,
        ok: false,
        timeMs: Date.now() - started,
        note: e.code || e.message || 'erro desconhecido',
      })
    }
  }

  return NextResponse.json({
    baseUrl,
    secretConfigured: !!secret,
    secretSuffix: secret ? '***' + secret.slice(-4) : null,
    timezone: process.env.TZ || 'UTC',
    nowBrt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    results,
  })
}
