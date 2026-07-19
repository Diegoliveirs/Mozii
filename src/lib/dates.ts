import {
  addYears,
  differenceInYears,
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function timeAgo(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
}

// parseISO trata 'YYYY-MM-DD' como meia-noite LOCAL (sem shift de fuso), ao
// contrário de new Date('YYYY-MM-DD') que assume UTC.
export function formatDate(iso: string): string {
  return format(parseISO(iso), "d 'de' MMMM, yyyy", { locale: ptBR })
}

// rótulo da faixa da timeline de Momentos: hoje / ontem / data por extenso.
export function formatDayLabel(iso: string): string {
  const d = parseISO(iso)
  if (isToday(d)) return 'hoje'
  if (isYesterday(d)) return 'ontem'
  return formatDate(iso)
}

// valor de <input type="date"> para hoje, em horário local ('YYYY-MM-DD').
export function todayInputValue(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

// marco de aniversário do espaço: anos completos + a data do último aniversário
// alcançado (para posicionar na timeline). null se ainda não fez 1 ano.
export function coupleAnniversary(createdAtIso: string): { years: number; dayKey: string } | null {
  const created = parseISO(createdAtIso)
  const years = differenceInYears(new Date(), created)
  if (years < 1) return null
  return { years, dayKey: format(addYears(created, years), 'yyyy-MM-dd') }
}
