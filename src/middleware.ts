import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware() {},
  {
    callbacks: {
      authorized({ token }) {
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Protege todas as rotas EXCETO:
     * - /login, /register (páginas públicas)
     * - /api/auth/* (NextAuth internamente)
     * - /api/companies (registro público de empresa)
     * - /_next/* (assets estáticos)
     * - /favicon.ico, /qr.html (arquivos públicos)
     */
    '/((?!login|register|api/auth|api/companies|_next/static|_next/image|favicon.ico|qr.html|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
}
