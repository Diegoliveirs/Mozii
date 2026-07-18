import { Link } from 'react-router-dom'
import { useEntitlement } from '../../hooks/useEntitlements'
import { daysLeft, isAppTrial } from '../../lib/premium'
import { t } from '../../lib/i18n'

/**
 * Card de trial no topo do Feed (dentro da área com safe-area — antes era uma
 * faixa no topo do app que ficava atrás do notch do iPhone e não era clicável).
 * Só aparece durante o trial do app (sem plano pago); conta os dias pra baixo.
 */
export function TrialBanner() {
  const { data: ent } = useEntitlement()
  if (!isAppTrial(ent)) return null
  return (
    <Link
      to="/premium"
      className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-rose/15 p-4 transition-transform active:scale-[0.98]"
    >
      <span className="text-sm text-rose-soft">{t.premium.trialDays(daysLeft(ent?.trialEndsAt ?? null))}</span>
      <span className="shrink-0 text-sm font-medium text-rose-soft underline">{t.premium.trialCta}</span>
    </Link>
  )
}
