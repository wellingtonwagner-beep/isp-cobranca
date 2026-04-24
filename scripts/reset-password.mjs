/**
 * Reseta a senha de uma empresa (login) diretamente no banco.
 *
 * Uso:
 *   node scripts/reset-password.mjs <email> <novaSenha>
 *
 * Exemplo:
 *   node scripts/reset-password.mjs admin@empresa.com NovaSenha123
 *
 * Requer: DATABASE_URL configurado no .env (mesmo do app).
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const [, , email, novaSenha] = process.argv

if (!email || !novaSenha) {
  console.error('Uso: node scripts/reset-password.mjs <email> <novaSenha>')
  process.exit(1)
}

if (novaSenha.length < 6) {
  console.error('Senha deve ter ao menos 6 caracteres.')
  process.exit(1)
}

const prisma = new PrismaClient()

try {
  const company = await prisma.company.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  })

  if (!company) {
    console.error(`Nenhuma empresa encontrada com e-mail "${email}".`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(novaSenha, 12)
  await prisma.company.update({
    where: { id: company.id },
    data: { passwordHash },
  })

  console.log(`Senha redefinida com sucesso para "${company.name}" (${company.email}).`)
  console.log('Você já pode fazer login com a nova senha.')
} catch (err) {
  console.error('Erro:', err)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
