import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'isp-session'
const secret = () => new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-prod')

export interface SessionPayload {
  companyId: string
  email: string
  name: string
  logo?: string | null
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function getSessionFromCookie(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export { COOKIE_NAME }
