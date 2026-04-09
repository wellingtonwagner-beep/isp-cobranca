/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  GitBranch,
  Settings,
  LogOut,
} from 'lucide-react'
import { clsx } from 'clsx'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/growth', label: 'Growth', icon: TrendingUp },
  { href: '/cobrancas', label: 'Cobranças', icon: CreditCard },
  { href: '/inadimplencia', label: 'Inadimplência', icon: AlertTriangle },
  { href: '/workflow', label: 'Workflow', icon: GitBranch },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="fixed left-0 top-0 h-full w-52 bg-[#1e1b4b] flex flex-col z-50">
      {/* Logo / empresa */}
      <div className="flex items-center gap-3 h-16 border-b border-purple-800/40 px-4">
        {session?.user?.logo ? (
          <img
            src={session.user.logo}
            alt="Logo"
            className="w-8 h-8 rounded-lg object-contain bg-white/10 p-0.5"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-purple-700 flex items-center justify-center text-white font-bold text-sm">
            {session?.user?.name?.charAt(0) || 'I'}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">
            {session?.user?.name || 'ISP Cobrança'}
          </p>
          <p className="text-purple-400 text-xs truncate">Sistema de Cobranças</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'sidebar-item',
                isActive ? 'active' : 'text-purple-200'
              )}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-purple-800/40">
        <div className="px-3 py-1.5 mb-1">
          <p className="text-purple-400 text-xs truncate">{session?.user?.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="sidebar-item text-purple-300 hover:text-white w-full"
        >
          <LogOut size={16} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}
