/**
 * Cria um super-administrador do sistema.
 *
 * Uso:
 *   node scripts/create-admin.mjs <email> <senha> <nome>
 *
 * Exemplo:
 *   node scripts/create-admin.mjs wellington@sistema.com MinhaSenhaForte123 "Wellington Wagner"
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const [, , email, senha, ...nomePartes] = process.argv
const nome = nomePartes.join(' ')

if (!email || !senha || !nome) {
  console.error('Uso: node scripts/create-admin.mjs <email> <senha> <nome>')
  process.exit(1)
}
if (senha.length < 8) {
  console.error('Senha deve ter ao menos 8 caracteres.')
  process.exit(1)
}

const prisma = new PrismaClient()

try {
  const passwordHash = await bcrypt.hash(senha, 12)
  const admin = await prisma.adminUser.upsert({
    where: { email: email.trim().toLowerCase() },
    update: { name: nome, passwordHash, active: true },
    create: { email: email.trim().toLowerCase(), name: nome, passwordHash, active: true },
    select: { id: true, email: true, name: true, active: true, createdAt: true },
  })
  console.log(`Super-admin salvo:`)
  console.log(`  id:     ${admin.id}`)
  console.log(`  nome:   ${admin.name}`)
  console.log(`  email:  ${admin.email}`)
  console.log(`  ativo:  ${admin.active}`)
  console.log(`\nFaça login em /admin/login com essas credenciais.`)
} catch (err) {
  console.error('Erro:', err)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
