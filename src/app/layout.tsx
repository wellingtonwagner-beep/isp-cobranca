import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'ISP Cobrança',
  description: 'Sistema de cobrança automatizada via WhatsApp para ISPs',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#f5f3ff] antialiased">
        <Sidebar />
        <main className="ml-48 min-h-screen">
          <div className="p-6 max-w-7xl">{children}</div>
        </main>
      </body>
    </html>
  )
}
