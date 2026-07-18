import type { Entitlement } from '../domain/types'

/** Tem plano PAGO vigente (vitalício ou assinatura ativa no Stripe)? */
export function hasPaidPlan(ent: Entitlement | undefined): boolean {
  if (!ent) return false
  return ent.isLifetime || ent.status === 'active' || ent.status === 'trialing'
}

/** Premium só pelo trial do app (7 dias do espaço novo), sem plano pago. */
export function isAppTrial(ent: Entitlement | undefined): boolean {
  if (!ent) return false
  return ent.isPremium && !hasPaidPlan(ent)
}

/** Dias restantes (arredondados p/ cima) até uma data ISO; 0 se nula/passada. */
export function daysLeft(iso: string | null): number {
  if (!iso) return 0
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/** Data por extenso em pt-BR (ex.: "17 de agosto de 2026"); vazio se nula. */
export function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

/** Preço em centavos → "R$ 9,90"; vazio se nulo. */
export function formatPrice(cents: number | null, currency: string | null): string {
  if (cents == null) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: (currency ?? 'BRL').toUpperCase(),
  }).format(cents / 100)
}
