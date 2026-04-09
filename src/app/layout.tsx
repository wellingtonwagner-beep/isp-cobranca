import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'ISP Cobrança',
  description: 'Sistema de cobrança automatizada via WhatsApp para ISPs',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#f5f3ff] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
