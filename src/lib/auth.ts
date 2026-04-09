import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const company = await prisma.company.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })

        if (!company || !company.active) return null

        const valid = await bcrypt.compare(credentials.password, company.passwordHash)
        if (!valid) return null

        return {
          id: company.id,
          companyId: company.id,
          email: company.email,
          name: company.name,
          logo: company.logo,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.companyId = user.companyId
        token.logo = user.logo
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.sub!
      session.user.companyId = token.companyId
      session.user.logo = token.logo
      return session
    },
  },
}
