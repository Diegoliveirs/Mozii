import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function timeAgo(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
}
