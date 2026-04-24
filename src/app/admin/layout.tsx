'use client'

import { usePathname } from 'next/navigation'
import AdminSidebar from '@/components/layout/AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/admin/login'

  if (isLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950 flex items-center justify-center p-4">
        {children}
      </div>
    )
  }

  return (
    <>
      <AdminSidebar />
      <main className="ml-52 min-h-screen">
        <div className="p-6 max-w-7xl">{children}</div>
      </main>
    </>
  )
}
