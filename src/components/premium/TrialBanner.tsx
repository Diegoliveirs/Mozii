import { Link } from 'react-router-dom'
import { useEntitlement } from '../../hooks/useEntitlements'
import { daysLeft, isAppTrial } from '../../lib/premium'
import { t } from '../../lib/i18n'

/** Faixa de trial no topo do app. Só aparece durante o trial (sem plano pago). */
export function TrialBanner() {
  const { data: ent } = useEntitlement()
  if (!isAppTrial(ent)) return null
  return (
    <Link
      to="/premium"
      className="flex items-center justify-between gap-2 bg-rose/15 px-4 py-2 text-xs text-rose-soft"
    >
      <span>{t.premium.trialDays(daysLeft(ent?.trialEndsAt ?? null))}</span>
      <span className="font-medium underline">{t.premium.trialCta}</span>
    </Link>
  )
}
