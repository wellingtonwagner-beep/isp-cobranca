import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/jwt'
import { verifyAdminToken, ADMIN_COOKIE_NAME } from '@/lib/admin-jwt'

// Rotas publicas (sem autenticacao alguma)
const PUBLIC_PATHS = [
  '/login', '/register',
  '/esqueci-senha', '/redefinir-senha',
  '/admin/login',
  '/api/auth/login', '/api/auth/logout',
  '/api/auth/forgot-password', '/api/auth/reset-password',
  '/api/admin-auth/login', '/api/admin-auth/logout',
  '/api/admin-auth/setup',
  '/api/companies', '/qr.html',
]

// Rotas que exigem ADMIN (super-admin do sistema)
const ADMIN_PREFIXES = ['/admin/', '/api/admin/', '/api/admin-auth/me']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Assets estaticos e rotas publicas
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(png|jpg|svg|ico|webp)$/) ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return NextResponse.next()
  }

  // Rotas admin: exigem cookie admin valido
  const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p) || pathname === p.replace(/\/$/, ''))
  if (isAdminRoute) {
    const adminToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value
    if (!adminToken) {
      const loginUrl = new URL('/admin/login', req.url)
      return NextResponse.redirect(loginUrl)
    }
    const adminSession = await verifyAdminToken(adminToken)
    if (!adminSession) {
      const loginUrl = new URL('/admin/login', req.url)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Demais rotas: exigem cookie de sessao de empresa
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const session = await verifyToken(token)
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
