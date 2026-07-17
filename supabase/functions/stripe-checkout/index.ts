// Cria uma sessão de Checkout EMBEDDED do Stripe e devolve o client_secret.
// O client monta o formulário num modal dentro do app (initEmbeddedCheckout) —
// sem redirect nem aba nova. Com redirect_on_completion: 'never', o pagamento
// termina no callback onComplete do próprio modal.
//
// Autenticado: o couple_id vem do JWT (server-side), NUNCA do body.
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { getStripe, getAdminClient, getUser, getCoupleId, priceForPlan } from '../_shared/clients.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405)

  try {
    const user = await getUser(req)
    if (!user) return jsonResponse({ error: 'não autenticado' }, 401)

    const coupleId = await getCoupleId(user.id)
    if (!coupleId) return jsonResponse({ error: 'sem espaço' }, 400)

    const { plan } = await req.json().catch(() => ({ plan: '' }))
    const chosen = priceForPlan(plan)
    if (!chosen || !chosen.price) return jsonResponse({ error: 'plano inválido' }, 400)

    const stripe = getStripe()
    const admin = getAdminClient()

    // reusa o Stripe Customer do espaço se já existir; senão cria e persiste
    // numa linha stub (status default 'incomplete' — não concede premium)
    const { data: existing } = await admin
      .from('subscriptions')
      .select('stripe_customer_id, is_lifetime')
      .eq('couple_id', coupleId)
      .maybeSingle()

    if (existing?.is_lifetime) return jsonResponse({ error: 'espaço já tem acesso vitalício' }, 409)

    let customerId = existing?.stripe_customer_id as string | undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id, couple_id: coupleId },
      })
      customerId = customer.id
      const { error } = await admin
        .from('subscriptions')
        .upsert(
          { couple_id: coupleId, paid_by: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
          { onConflict: 'couple_id' },
        )
      if (error) throw error
    }

    const meta = { couple_id: coupleId, supabase_user_id: user.id, plan }
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      redirect_on_completion: 'never',
      mode: chosen.mode,
      customer: customerId,
      line_items: [{ price: chosen.price, quantity: 1 }],
      client_reference_id: coupleId,
      // metadata na session E na subscription/payment_intent, para o webhook
      // resolver o espaço em qualquer evento
      metadata: meta,
      ...(chosen.mode === 'subscription'
        ? { subscription_data: { metadata: meta } }
        : { payment_intent_data: { metadata: meta } }),
    })

    return jsonResponse({ clientSecret: session.client_secret })
  } catch (err) {
    console.error('stripe-checkout error', err)
    return jsonResponse({ error: 'falha ao criar checkout' }, 500)
  }
})
