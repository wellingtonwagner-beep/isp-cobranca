import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/jwt'

const PUBLIC_PATHS = [
  '/login', '/register',
  '/esqueci-senha', '/redefinir-senha',
  '/api/auth/login', '/api/auth/logout',
  '/api/auth/forgot-password', '/api/auth/reset-password',
  '/api/companies', '/qr.html',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Permite assets estáticos e rotas públicas
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(png|jpg|svg|ico|webp)$/) ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return NextResponse.next()
  }

  // Verifica cookie de sessão
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
