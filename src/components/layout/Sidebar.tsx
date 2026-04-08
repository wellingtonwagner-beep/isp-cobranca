'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  GitBranch,
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
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-48 bg-[#1e1b4b] flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-purple-800/40 px-4">
        <div className="text-white font-bold text-lg tracking-wide">
          <span className="text-purple-300">ISP</span>
          <span className="text-white ml-1">Cobrança</span>
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
        <TestModeBadge />
        <button className="sidebar-item text-purple-300 w-full mt-1">
          <LogOut size={16} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}

function TestModeBadge() {
  // Simples — em prod leria da API /api/config
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-green-400 font-medium">
      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      MODO TESTE
    </div>
  )
}
