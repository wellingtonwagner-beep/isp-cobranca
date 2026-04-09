/**
 * Seed mínimo para multi-tenant.
 * Config e Holiday agora pertencem a empresas — seed é feito via UI/API após cadastro.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seed concluído — no ambiente multi-tenant, cadastre sua empresa em /register.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
