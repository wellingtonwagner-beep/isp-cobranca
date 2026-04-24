/**
 * Lista todas as empresas cadastradas no sistema.
 *
 * Uso:
 *   node scripts/list-companies.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      cnpj: true,
      plan: true,
      active: true,
      createdAt: true,
      _count: {
        select: { clients: true, invoices: true, messageLogs: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (companies.length === 0) {
    console.log('Nenhuma empresa cadastrada.')
    process.exit(0)
  }

  console.log(`${companies.length} empresa(s) cadastrada(s):\n`)
  for (const c of companies) {
    console.log(`  ${c.active ? '●' : '○'} ${c.name}`)
    console.log(`    e-mail:   ${c.email}`)
    console.log(`    cnpj:     ${c.cnpj}`)
    console.log(`    plano:    ${c.plan}`)
    console.log(`    clientes: ${c._count.clients} | faturas: ${c._count.invoices} | mensagens: ${c._count.messageLogs}`)
    console.log(`    criada:   ${c.createdAt.toISOString().slice(0, 10)}`)
    console.log(`    id:       ${c.id}`)
    console.log()
  }
} catch (err) {
  console.error('Erro:', err)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
