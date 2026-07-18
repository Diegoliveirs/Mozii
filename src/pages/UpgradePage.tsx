import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PremiumPlan } from '../domain/types'
import { useCreateCheckout, useEntitlement } from '../hooks/useEntitlements'
import { CheckoutModal } from '../components/premium/CheckoutModal'
import { daysLeft, hasPaidPlan, isAppTrial } from '../lib/premium'
import { t } from '../lib/i18n'

const PLANS: { plan: PremiumPlan; hint: string }[] = [
  { plan: 'monthly', hint: t.premium.monthlyHint },
  { plan: 'weekly', hint: t.premium.weeklyHint },
  { plan: 'lifetime', hint: t.premium.lifetimeHint },
]

const CONFIRM_TIMEOUT_MS = 90_000

export function UpgradePage() {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [slow, setSlow] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const slowTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const checkout = useCreateCheckout()
  // polling de 2s enquanto espera o webhook gravar o pagamento
  const { data: ent } = useEntitlement(confirming)
  const paid = hasPaidPlan(ent)

  // pagamento confirmado no banco → para o polling e celebra
  useEffect(() => {
    if (confirming && paid) {
      setConfirming(false)
      setSlow(false)
      if (slowTimer.current) clearTimeout(slowTimer.current)
    }
  }, [confirming, paid])

  useEffect(() => () => {
    if (slowTimer.current) clearTimeout(slowTimer.current)
  }, [])

  async function subscribe(plan: PremiumPlan) {
    setError(null)
    try {
      const { clientSecret } = await checkout.mutateAsync(plan)
      setClientSecret(clientSecret)
    } catch {
      setError(t.premium.checkoutError)
    }
  }

  function handleComplete() {
    // pagamento terminou no modal — o webhook concede; aqui só acompanhamos
    setClientSecret(null)
    setConfirming(true)
    slowTimer.current = setTimeout(() => setSlow(true), CONFIRM_TIMEOUT_MS)
  }

  return (
    <div className="px-4 pt-6">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-ash">
        ← {t.nav.profile}
      </button>

      <h1 className="font-voice text-3xl text-snow">{t.premium.title}</h1>
      <p className="mt-1 mb-6 text-sm text-ash">{t.premium.subtitle}</p>

      <ul className="mb-6 space-y-2">
        {t.premium.benefits.map((b) => (
          <li key={b} className="flex items-center gap-2 text-sm text-snow">
            <span className="text-rose">✓</span>
            {b}
          </li>
        ))}
      </ul>

      {confirming ? (
        <div className="rounded-2xl bg-card p-6 text-center">
          <p className="text-sm font-medium text-snow">{t.premium.confirming}</p>
          <p className="mt-1 text-xs text-ash">{slow ? t.premium.confirmDelay : t.premium.confirmingHint}</p>
        </div>
      ) : paid ? (
        <div className="rounded-2xl bg-card p-5 text-center">
          <p className="text-sm font-medium text-snow">
            {ent?.isLifetime ? t.premium.lifetimeActive : t.premium.confirmed}
          </p>
          <button
            onClick={() => navigate('/perfil')}
            className="mt-4 w-full rounded-xl bg-rose py-3 text-sm font-medium text-white"
          >
            {t.nav.profile}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {PLANS.map(({ plan, hint }) => (
            <button
              key={plan}
              onClick={() => subscribe(plan)}
              disabled={checkout.isPending}
              className="flex w-full items-center justify-between rounded-2xl bg-card p-4 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <span>
                <span className="block text-base font-medium text-snow">{t.premium.plans[plan]}</span>
                <span className="block text-xs text-ash">{hint}</span>
              </span>
              <span className="rounded-xl bg-rose px-4 py-2 text-sm font-medium text-white">
                {plan === 'lifetime' ? t.premium.ctaLifetime : t.premium.cta}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-center text-sm text-rose-soft">{error}</p>}

      {isAppTrial(ent) && !confirming && (
        <p className="mt-4 text-center text-xs text-ash">
          {t.premium.trialDays(daysLeft(ent?.trialEndsAt ?? null))}
        </p>
      )}

      {clientSecret && (
        <CheckoutModal
          clientSecret={clientSecret}
          onComplete={handleComplete}
          onClose={() => setClientSecret(null)}
        />
      )}
    </div>
  )
}
