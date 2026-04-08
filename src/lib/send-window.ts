import { nowBRT } from './utils'

/**
 * Verifica se o horário atual (BRT) está dentro da janela de envio.
 * Padrão: 08:00–20:00, Segunda a Sábado (1–6)
 */
export function isWithinSendWindow(
  windowStart = '08:00',
  windowEnd = '20:00',
  sendDays = '1,2,3,4,5,6'
): boolean {
  const now = nowBRT()
  const dayOfWeek = now.getDay() // 0=Dom, 1=Seg, ..., 6=Sáb

  const allowedDays = sendDays.split(',').map(Number)
  if (!allowedDays.includes(dayOfWeek)) return false

  const [startH, startM] = windowStart.split(':').map(Number)
  const [endH, endM] = windowEnd.split(':').map(Number)

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  return currentMinutes >= startMinutes && currentMinutes < endMinutes
}
