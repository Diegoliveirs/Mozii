// Cancela (ou retoma) a assinatura recorrente do espaço DENTRO do app —
// sem Billing Portal. Cancelamento é sempre no fim do período já pago
// (cancel_at_period_end), nunca imediato.
//
// Autorização: só quem pagou (paid_by) cancela/retoma. O webhook
// customer.subscription.updated confirma a mudança; ainda assim gravamos
// otimisticamente no banco para a UI refletir na hora.
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { getStripe, getAdminClient, getUser, getCoupleId } from '../_shared/clients.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405)

  try {
    const user = await getUser(req)
    if (!user) return jsonResponse({ error: 'não autenticado' }, 401)

    const coupleId = await getCoupleId(user.id)
    if (!coupleId) return jsonResponse({ error: 'sem espaço' }, 400)

    const { action } = await req.json().catch(() => ({ action: 'cancel' }))
    if (action !== 'cancel' && action !== 'resume') return jsonResponse({ error: 'ação inválida' }, 400)

    const admin = getAdminClient()
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_subscription_id, paid_by, is_lifetime, status')
      .eq('couple_id', coupleId)
      .maybeSingle()

    if (!sub?.stripe_subscription_id || sub.is_lifetime)
      return jsonResponse({ error: 'sem assinatura recorrente' }, 404)
    if (sub.paid_by && sub.paid_by !== user.id)
      return jsonResponse({ error: 'só quem assinou pode alterar a assinatura' }, 403)

    const cancelAtPeriodEnd = action === 'cancel'
    await getStripe().subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: cancelAtPeriodEnd,
    })

    const { error } = await admin
      .from('subscriptions')
      .update({ cancel_at_period_end: cancelAtPeriodEnd, updated_at: new Date().toISOString() })
      .eq('couple_id', coupleId)
    if (error) throw error

    return jsonResponse({ ok: true, cancelAtPeriodEnd })
  } catch (err) {
    console.error('stripe-cancel error', err)
    return jsonResponse({ error: 'falha ao alterar assinatura' }, 500)
  }
})
