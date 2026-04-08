import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // Config padrão
  const defaults: Record<string, string> = {
    test_mode: 'true',
    send_window_start: '08:00',
    send_window_end: '20:00',
    send_days: '1,2,3,4,5,6',
    evolution_instance: 'default',
    sgp_sync_enabled: 'true',
    company_name: 'UltraNet Telecom',
    company_whatsapp: '5537998558119',
    company_hours: 'Seg-Sex 8h às 18h | Sáb 8h às 12h',
  }

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.config.upsert({
      where: { key },
      update: {},
      create: { key, value },
    })
  }

  console.log('✅ Config padrão criada')

  // Feriados nacionais 2025
  const holidays2025 = [
    { date: '2025-01-01', description: 'Confraternização Universal' },
    { date: '2025-04-18', description: 'Sexta-Feira Santa' },
    { date: '2025-04-21', description: 'Tiradentes' },
    { date: '2025-05-01', description: 'Dia do Trabalho' },
    { date: '2025-06-19', description: 'Corpus Christi' },
    { date: '2025-09-07', description: 'Independência do Brasil' },
    { date: '2025-10-12', description: 'Nossa Senhora Aparecida' },
    { date: '2025-11-02', description: 'Finados' },
    { date: '2025-11-15', description: 'Proclamação da República' },
    { date: '2025-12-25', description: 'Natal' },
  ]

  // Feriados nacionais 2026
  const holidays2026 = [
    { date: '2026-01-01', description: 'Confraternização Universal' },
    { date: '2026-02-17', description: 'Carnaval' },
    { date: '2026-02-18', description: 'Carnaval' },
    { date: '2026-04-03', description: 'Sexta-Feira Santa' },
    { date: '2026-04-21', description: 'Tiradentes' },
    { date: '2026-05-01', description: 'Dia do Trabalho' },
    { date: '2026-06-04', description: 'Corpus Christi' },
    { date: '2026-09-07', description: 'Independência do Brasil' },
    { date: '2026-10-12', description: 'Nossa Senhora Aparecida' },
    { date: '2026-11-02', description: 'Finados' },
    { date: '2026-11-15', description: 'Proclamação da República' },
    { date: '2026-12-25', description: 'Natal' },
  ]

  for (const h of [...holidays2025, ...holidays2026]) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: {},
      create: { date: h.date, description: h.description, source: 'fixed' },
    })
  }

  console.log('✅ Feriados 2025/2026 criados')
  console.log('🎉 Seed concluído!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
