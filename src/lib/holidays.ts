import { prisma } from './prisma'
import { todayStrBRT } from './utils'

// Feriados nacionais fixos (mês/dia)
const FIXED_HOLIDAYS: { month: number; day: number; description: string }[] = [
  { month: 1, day: 1, description: 'Confraternização Universal' },
  { month: 4, day: 21, description: 'Tiradentes' },
  { month: 5, day: 1, description: 'Dia do Trabalho' },
  { month: 9, day: 7, description: 'Independência do Brasil' },
  { month: 10, day: 12, description: 'Nossa Senhora Aparecida' },
  { month: 11, day: 2, description: 'Finados' },
  { month: 11, day: 15, description: 'Proclamação da República' },
  { month: 12, day: 25, description: 'Natal' },
]

export async function isTodayHoliday(): Promise<boolean> {
  const today = todayStrBRT()

  // Verifica no banco primeiro
  const dbHoliday = await prisma.holiday.findUnique({ where: { date: today } })
  if (dbHoliday) return true

  // Verifica feriados fixos nacionais
  const [, monthStr, dayStr] = today.split('-')
  const month = parseInt(monthStr)
  const day = parseInt(dayStr)

  return FIXED_HOLIDAYS.some((h) => h.month === month && h.day === day)
}

export async function seedFixedHolidays(year: number): Promise<void> {
  for (const h of FIXED_HOLIDAYS) {
    const dateStr = `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`
    await prisma.holiday.upsert({
      where: { date: dateStr },
      update: {},
      create: { date: dateStr, description: h.description, source: 'fixed' },
    })
  }
}
