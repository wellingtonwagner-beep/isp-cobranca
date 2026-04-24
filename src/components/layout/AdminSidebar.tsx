'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Building2, Users, LogOut, Shield } from 'lucide-react'
import { clsx } from 'clsx'

interface AdminInfo { id: string; email: string; name: string }

const items = [
  { href: '/admin/empresas', label: 'Empresas', icon: Building2 },
  { href: '/admin/admins', label: 'Administradores', icon: Users },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminInfo | null>(null)

  useEffect(() => {
    fetch('/api/admin-auth/me')
      .then((r) => r.json())
      .then((d) => { if (d.admin) setAdmin(d.admin) })
      .catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/admin-auth/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-52 bg-amber-950 flex flex-col z-50">
      <div className="flex items-center gap-3 h-16 border-b border-amber-800/40 px-4">
        <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center">
          <Shield size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">Admin Sistema</p>
          <p className="text-amber-300 text-xs truncate">{admin?.name || '...'}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-amber-600 text-white' : 'text-amber-200 hover:bg-amber-900/50'
              )}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-amber-800/40">
        <div className="px-3 py-1.5 mb-1">
          <p className="text-amber-300 text-xs truncate">{admin?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-amber-200 hover:bg-amber-900/50 w-full"
        >
          <LogOut size={16} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}
