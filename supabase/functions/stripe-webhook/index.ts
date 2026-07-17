// Webhook do Stripe: ÚNICO ponto que concede/revoga premium.
// Verifica a assinatura HMAC e grava em `subscriptions` (por couple_id) com a
// service-role. verify_jwt = false (config.toml): quem chama é o Stripe.
//
// Eventos assinados no endpoint: checkout.session.completed,
// checkout.session.async_payment_succeeded, customer.subscription.created/
// updated/deleted. invoice.* fica de fora de propósito — mudança de status por
// falha de cobrança também dispara customer.subscription.updated, que já
// sincroniza tudo (menos eventos = menos modos de falha).
import Stripe from 'npm:stripe@17'
import { getStripe, getAdminClient, planForPrice } from '../_shared/clients.ts'

// verificação de assinatura no Deno exige o provider assíncrono de SubtleCrypto
const cryptoProvider = Stripe.createSubtleCryptoProvider()

type SubRow = {
  couple_id: string
  paid_by?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  plan?: string | null
  status?: string
  is_lifetime?: boolean
  current_period_end?: string | null
  price_amount?: number | null
  currency?: string | null
  cancel_at_period_end?: boolean
  updated_at: string
}

async function upsert(row: SubRow) {
  const admin = getAdminClient()
  const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'couple_id' })
  if (error) throw error
}

/** couple_id: metadata → client_reference_id → lookup pelo customer persistido. */
async function resolveCoupleId(
  meta: Record<string, string> | null | undefined,
  clientReferenceId?: string | null,
  customerId?: string | null,
): Promise<string | null> {
  if (meta?.couple_id) return meta.couple_id
  if (clientReferenceId) return clientReferenceId
  if (customerId) {
    const admin = getAdminClient()
    const { data } = await admin
      .from('subscriptions')
      .select('couple_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    return (data?.couple_id as string | null) ?? null
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const sig = req.headers.get('stripe-signature')
  const secret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')
  if (!sig || !secret) return new Response('missing signature/secret', { status: 400 })

  // corpo CRU antes de qualquer parse — a verificação HMAC exige os bytes originais
  const body = await req.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret, undefined, cryptoProvider)
  } catch (err) {
    console.error('assinatura inválida', err)
    return new Response('assinatura inválida', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object as Stripe.Checkout.Session
        const coupleId = await resolveCoupleId(
          s.metadata as Record<string, string>,
          s.client_reference_id,
          s.customer as string,
        )
        if (!coupleId) break // fixture do `stripe trigger` não tem couple_id → no-op com 200
        if (s.mode === 'payment' && s.payment_status !== 'unpaid') {
          // vitalício: pagamento único, sem recorrência
          await upsert({
            couple_id: coupleId,
            paid_by: s.metadata?.supabase_user_id ?? null,
            stripe_customer_id: s.customer as string,
            plan: 'lifetime',
            status: 'active',
            is_lifetime: true,
            current_period_end: null,
            price_amount: s.amount_total,
            currency: s.currency,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
        }
        // mode === 'subscription' é tratado nos eventos customer.subscription.*
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // created/updated chegam no MESMO segundo e a entrega não tem ordem
        // garantida — um created (incomplete) atrasado sobrescrevia o updated
        // (active). Busca o estado ATUAL na API em vez de confiar no snapshot.
        const evSub = event.data.object as Stripe.Subscription
        const sub = await stripe.subscriptions.retrieve(evSub.id)
        const coupleId = await resolveCoupleId(
          sub.metadata as Record<string, string>,
          null,
          sub.customer as string,
        )
        if (!coupleId) break
        const item = sub.items.data[0]
        // current_period_end saiu do topo da Subscription e passou para o item
        // na API "basil" (2025-03-31); lê do item com fallback ao topo.
        const periodEndUnix =
          (item as unknown as { current_period_end?: number })?.current_period_end ??
          (sub as unknown as { current_period_end?: number }).current_period_end
        await upsert({
          couple_id: coupleId,
          paid_by: sub.metadata?.supabase_user_id ?? null,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          plan: planForPrice(item?.price?.id),
          status: sub.status, // trialing | active | past_due | canceled | ...
          is_lifetime: false,
          current_period_end:
            typeof periodEndUnix === 'number' ? new Date(periodEndUnix * 1000).toISOString() : null,
          price_amount: item?.price?.unit_amount ?? null,
          currency: item?.price?.currency ?? null,
          cancel_at_period_end: sub.cancel_at_period_end === true,
          updated_at: new Date().toISOString(),
        })
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const coupleId = await resolveCoupleId(
          sub.metadata as Record<string, string>,
          null,
          sub.customer as string,
        )
        if (!coupleId) break
        await upsert({
          couple_id: coupleId,
          stripe_subscription_id: sub.id,
          status: 'canceled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('falha ao processar evento', event.type, err)
    return new Response('erro ao processar', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
