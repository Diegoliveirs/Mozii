import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useCancelSubscription,
  useEntitlement,
  useOpenPortal,
  useResumeSubscription,
} from '../../hooks/useEntitlements'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { daysLeft, formatDate, formatPrice, hasPaidPlan, isAppTrial } from '../../lib/premium'
import { t } from '../../lib/i18n'

/**
 * Cartão "Gerenciar assinatura" no perfil — tudo DENTRO do app:
 * plano + valor + próxima renovação, cancelar/retomar. O portal do Stripe
 * fica só como link secundário para trocar a forma de pagamento.
 */
export function PremiumBadge() {
  const { data: ent } = useEntitlement()
  const cancel = useCancelSubscription()
  const resume = useResumeSubscription()
  const portal = useOpenPortal()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!ent) return null

  // free (sem trial nem assinatura): convite para conhecer o Premium
  if (!ent.isPremium) {
    return (
      <Link
        to="/premium"
        className="flex items-center justify-between rounded-2xl bg-card p-4 transition-transform active:scale-[0.98]"
      >
        <span className="text-sm font-medium text-snow">✨ {t.premium.goPremium}</span>
        <span className="text-ash">›</span>
      </Link>
    )
  }

  // trial do app: dias restantes + CTA
  if (isAppTrial(ent)) {
    return (
      <div className="flex items-center justify-between rounded-2xl bg-card p-4">
        <span className="text-sm text-snow">{t.premium.trialDays(daysLeft(ent.trialEndsAt))}</span>
        <Link to="/premium" className="text-xs text-rose-soft underline">
          {t.premium.trialCta}
        </Link>
      </div>
    )
  }

  const recurring = hasPaidPlan(ent) && !ent.isLifetime
  const price = formatPrice(ent.priceAmount, ent.currency)
  const renewDate = formatDate(ent.currentPeriodEnd)

  async function handleCancel() {
    setConfirmCancel(false)
    setError(null)
    try {
      await cancel.mutateAsync()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    }
  }

  async function handleResume() {
    setError(null)
    try {
      await resume.mutateAsync()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    }
  }

  async function handlePortal() {
    setError(null)
    try {
      const { url } = await portal.mutateAsync()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    }
  }

  return (
    <div className="rounded-2xl bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-snow">
          {ent.isLifetime ? t.premium.lifetimeActive : t.premium.active}
        </span>
        <span aria-hidden="true">✨</span>
      </div>

      {/* detalhes da cobrança: plano, valor e próxima renovação */}
      {ent.isLifetime ? (
        <p className="mt-1 text-xs text-ash">{t.premium.lifetimeNote}</p>
      ) : (
        <div className="mt-1 space-y-0.5 text-xs text-ash">
          {ent.plan && (
            <p className="text-snow/80">
              {t.premium.planLabel[ent.plan]}
              {price && <> · {price}</>}
            </p>
          )}
          {ent.cancelAtPeriodEnd ? (
            <p className="text-rose-soft">{t.premium.canceledUntil(renewDate)}</p>
          ) : (
            <>
              <p>✓ {t.premium.autoRenew}</p>
              {renewDate && <p>{t.premium.nextCharge(renewDate)}</p>}
            </>
          )}
        </div>
      )}

      {recurring && (
        <div className="mt-3 space-y-2">
          {ent.cancelAtPeriodEnd ? (
            <button
              onClick={handleResume}
              disabled={resume.isPending}
              className="w-full rounded-xl bg-rose py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {t.premium.resume}
            </button>
          ) : (
            <button
              onClick={() => setConfirmCancel(true)}
              disabled={cancel.isPending}
              className="w-full rounded-xl border border-line-strong py-2.5 text-sm text-snow disabled:opacity-60"
            >
              {t.premium.cancel}
            </button>
          )}
          <button
            onClick={handlePortal}
            disabled={portal.isPending}
            className="w-full py-1 text-center text-xs text-ash underline disabled:opacity-60"
          >
            {t.premium.managePayment}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-soft">{error}</p>}

      {confirmCancel && (
        <ConfirmDialog
          message={t.premium.cancelConfirm(renewDate)}
          confirmLabel={t.premium.cancel}
          onConfirm={handleCancel}
          onCancel={() => setConfirmCancel(false)}
        />
      )}
    </div>
  )
}
