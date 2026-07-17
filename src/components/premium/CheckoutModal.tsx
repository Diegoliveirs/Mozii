import { useEffect, useRef } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { t } from '../../lib/i18n'

// singleton: loadStripe deve rodar uma vez por página
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '')

/**
 * Stripe Embedded Checkout num modal DENTRO do app — sem redirect nem aba
 * nova. `onComplete` dispara quando o pagamento termina; quem concede o
 * premium é o webhook (o caller só liga o polling do entitlement).
 */
export function CheckoutModal({
  clientSecret,
  onComplete,
  onClose,
}: {
  clientSecret: string
  onComplete: () => void
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    // instância única por página: destrói no unmount (StrictMode monta 2x em dev)
    let instance: import('@stripe/stripe-js').StripeEmbeddedCheckout | null = null

    async function init() {
      const stripe = await stripePromise
      if (!stripe || cancelled || !containerRef.current) return
      const checkout = await stripe.createEmbeddedCheckoutPage({ clientSecret, onComplete })
      if (cancelled) {
        checkout.destroy()
        return
      }
      instance = checkout
      checkout.mount(containerRef.current)
    }
    init()

    return () => {
      cancelled = true
      instance?.destroy()
    }
  }, [clientSecret, onComplete])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80" role="dialog" aria-modal="true">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          onClick={onClose}
          className="mb-2 self-end rounded-full bg-card px-4 py-2 text-sm text-snow"
        >
          {t.common.cancel}
        </button>
        {/* o iframe do Stripe é claro — container branco evita "flash" escuro */}
        <div ref={containerRef} className="flex-1 overflow-y-auto rounded-2xl bg-white" />
      </div>
    </div>
  )
}
