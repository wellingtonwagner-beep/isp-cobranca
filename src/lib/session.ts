/**
 * Helper para obter a sessão autenticada em Server Components e API routes.
 * Retorna null se não autenticado.
 */
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export async function getSession() {
  return getServerSession(authOptions)
}

export async function requireSession() {
  const session = await getSession()
  if (!session?.user?.companyId) return null
  return session
}

export async function getCompanyId(): Promise<string | null> {
  const session = await requireSession()
  return session?.user?.companyId ?? null
}
