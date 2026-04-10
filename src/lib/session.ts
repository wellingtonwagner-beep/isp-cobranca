import { getSessionFromCookie } from './jwt'

export async function getSession() {
  return getSessionFromCookie()
}

export async function getCompanyId(): Promise<string | null> {
  const session = await getSessionFromCookie()
  return session?.companyId ?? null
}
