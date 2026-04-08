import { format, parseISO, addDays } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const TZ = 'America/Sao_Paulo'

export function nowBRT(): Date {
  return toZonedTime(new Date(), TZ)
}

export function todayStrBRT(): string {
  return format(nowBRT(), 'yyyy-MM-dd')
}

export function addDaysBRT(date: Date, days: number): Date {
  return addDays(date, days)
}

export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(toZonedTime(d, TZ), 'dd/MM/yyyy')
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Normaliza número de telefone para formato Evolution API: 5511999999999
 * Aceita: (11) 99999-9999, 11999999999, +5511999999999, etc.
 */
export function normalizePhone(phone: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')

  // Se já tem código do país (55) e tem 12-13 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }

  // Se tem 10-11 dígitos (DDD + número)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return null
}

export function parseDate(dateStr: string): Date {
  // Suporta YYYY-MM-DD e DD/MM/YYYY
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/')
    return fromZonedTime(new Date(`${y}-${m}-${d}T00:00:00`), TZ)
  }
  return fromZonedTime(new Date(`${dateStr}T00:00:00`), TZ)
}

export function dateToBRTString(date: Date): string {
  return format(toZonedTime(date, TZ), 'yyyy-MM-dd')
}
