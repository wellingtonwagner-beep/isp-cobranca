import { prisma } from '@/lib/prisma'
import { todayStrBRT } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Users, FileText, AlertTriangle, MessageSquare, RefreshCw, TrendingUp } from 'lucide-react'
import Link from 'next/link'

async function getDashboardData() {
  try {
    const today = todayStrBRT()
    const todayStart = new Date(`${today}T00:00:00.000Z`)
    const todayEnd = new Date(`${today}T23:59:59.999Z`)
    const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`)

    const [totalClients, activeClients, openInvoices, overdueInvoices, todayLogs, monthLogs] =
      await Promise.all([
        prisma.client.count(),
        prisma.client.count({ where: { status: 'ativo' } }),
        prisma.invoice.count({ where: { status: 'aberta' } }),
        prisma.invoice.count({
          where: { status: { in: ['aberta', 'vencida'] }, dueDate: { lt: todayStart } },
        }),
        prisma.messageLog.count({ where: { sentAt: { gte: todayStart, lte: todayEnd } } }),
        prisma.messageLog.count({ where: { sentAt: { gte: monthStart } } }),
      ])

    return { totalClients, activeClients, openInvoices, overdueInvoices, todayLogs, monthLogs }
  } catch {
    return { totalClients: 0, activeClients: 0, openInvoices: 0, overdueInvoices: 0, todayLogs: 0, monthLogs: 0 }
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  const metrics = [
    {
      label: 'Clientes Ativos',
      value: data.activeClients,
      sub: `${data.totalClients} total`,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      href: '/clientes',
    },
    {
      label: 'Faturas Abertas',
      value: data.openInvoices,
      sub: 'aguardando pagamento',
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/cobrancas',
    },
    {
      label: 'Inadimplentes',
      value: data.overdueInvoices,
      sub: 'faturas vencidas',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/inadimplencia',
    },
    {
      label: 'Envios Hoje',
      value: data.todayLogs,
      sub: `${data.monthLogs} neste mês`,
      icon: MessageSquare,
      color: 'text-green-600',
      bg: 'bg-green-50',
      href: '/cobrancas',
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral do sistema de cobrança</p>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <Link key={m.label} href={m.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 py-5">
                <div className={`${m.bg} p-3 rounded-xl`}>
                  <m.icon className={`${m.color} w-5 h-5`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{m.value}</p>
                  <p className="text-sm font-medium text-gray-600">{m.label}</p>
                  <p className="text-xs text-gray-400">{m.sub}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3 mb-3">
              <RefreshCw className="text-purple-600 w-4 h-4" />
              <h3 className="font-semibold text-gray-800 text-sm">Sincronização SGP</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Sincronize clientes e faturas do SGP manualmente.</p>
            <div className="flex gap-2">
              <SyncButton endpoint="/api/sync/clientes" label="Clientes" />
              <SyncButton endpoint="/api/sync/faturas" label="Faturas" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="text-purple-600 w-4 h-4" />
              <h3 className="font-semibold text-gray-800 text-sm">Central de Cobranças</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Gerencie os disparos de cobrança via WhatsApp.</p>
            <Link
              href="/cobrancas"
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Ver Cobranças
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="text-purple-600 w-4 h-4" />
              <h3 className="font-semibold text-gray-800 text-sm">Workflow de Cobrança</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Visualize e configure os 7 estágios de cobrança.</p>
            <Link
              href="/workflow"
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Ver Workflow
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SyncButton({ endpoint, label }: { endpoint: string; label: string }) {
  return (
    <form
      action={async () => {
        'use server'
        await fetch(`http://localhost:3000${endpoint}`, {
          method: 'POST',
          headers: { 'x-cron-secret': process.env.CRON_SECRET || '' },
        }).catch(() => {})
      }}
    >
      <button
        type="submit"
        className="text-xs bg-white border border-purple-200 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
      >
        {label}
      </button>
    </form>
  )
}
