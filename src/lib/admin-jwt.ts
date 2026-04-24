import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const ADMIN_COOKIE_NAME = 'isp-admin-session'
const secret = () => new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-prod')

export interface AdminSessionPayload {
  adminId: string
  email: string
  name: string
  type: 'admin'
}

export async function signAdminToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

export async function verifyAdminToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    const p = payload as unknown as AdminSessionPayload
    if (p.type !== 'admin') return null
    return p
  } catch {
    return null
  }
}

export async function getAdminSessionFromCookie(): Promise<AdminSessionPayload | null> {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value
  if (!token) return null
  return verifyAdminToken(token)
}

export { ADMIN_COOKIE_NAME }
