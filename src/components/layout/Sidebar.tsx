/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, TrendingUp, CreditCard,
  AlertTriangle, GitBranch, Settings, LogOut, Sun, Moon, FileBarChart, Shield, Stethoscope,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useTheme } from '@/components/theme-provider'
import { hasFeature, type Feature, type Plan, PLAN_LABELS } from '@/lib/plans'

interface UserInfo {
  name: string
  email: string
  logo?: string | null
  plan?: Plan
  isSuperAdmin?: boolean
}

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  feature?: Feature
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, feature: 'dashboard' },
  { href: '/clientes', label: 'Clientes', icon: Users, feature: 'sync_erp' },
  { href: '/growth', label: 'Growth', icon: TrendingUp, feature: 'dashboard' },
  { href: '/cobrancas', label: 'Cobranças', icon: CreditCard, feature: 'regua_basica' },
  { href: '/inadimplencia', label: 'Inadimplência', icon: AlertTriangle, feature: 'regua_basica' },
  { href: '/relatorios/diario', label: 'Relatório Diário', icon: FileBarChart, feature: 'relatorio_diario' },
  { href: '/diagnostico', label: 'Diagnóstico', icon: Stethoscope },
  { href: '/workflow', label: 'Workflow', icon: GitBranch, feature: 'regua_basica' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => { if (d.user) setUser(d.user) })
      .catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const visibleItems = navItems.filter((item) => !item.feature || hasFeature(user?.plan, item.feature))

  return (
    <aside className="fixed left-0 top-0 h-full w-52 bg-[#1e1b4b] flex flex-col z-50">
      {/* Logo / empresa */}
      <div className="flex items-center gap-3 h-16 border-b border-purple-800/40 px-4">
        {user?.logo ? (
          <img src={user.logo} alt="Logo" className="w-9 h-9 rounded-lg object-contain bg-white p-0.5" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-purple-700 flex items-center justify-center text-white font-bold text-sm">
            {user?.name?.charAt(0) || 'I'}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">
            {user?.name || 'ISP Cobrança'}
          </p>
          <p className="text-purple-400 text-xs truncate">
            Plano {user?.plan ? PLAN_LABELS[user.plan] : 'Lite'}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={clsx('sidebar-item', isActive ? 'active' : 'text-purple-200')}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          )
        })}
        {user?.isSuperAdmin && (
          <Link
            href="/admin/empresas"
            className={clsx('sidebar-item', pathname.startsWith('/admin') ? 'active' : 'text-amber-300')}
          >
            <Shield size={16} />
            <span>Admin</span>
          </Link>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-purple-800/40">
        <div className="px-3 py-1.5 mb-1">
          <p className="text-purple-400 text-xs truncate">{user?.email}</p>
        </div>
        <button
          onClick={toggleTheme}
          className="sidebar-item text-purple-300 hover:text-white w-full mb-1"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          <span>{theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</span>
        </button>
        <button onClick={handleLogout} className="sidebar-item text-purple-300 hover:text-white w-full">
          <LogOut size={16} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}
