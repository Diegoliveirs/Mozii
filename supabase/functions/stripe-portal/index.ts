// Abre o Customer Portal do Stripe — uso SECUNDÁRIO (trocar forma de
// pagamento). Cancelamento é dentro do app via stripe-cancel.
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

    const admin = getAdminClient()
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('couple_id', coupleId)
      .maybeSingle()

    const customerId = sub?.stripe_customer_id as string | undefined
    if (!customerId) return jsonResponse({ error: 'sem assinatura' }, 404)

    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
    const portal = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/perfil`,
    })

    return jsonResponse({ url: portal.url })
  } catch (err) {
    console.error('stripe-portal error', err)
    return jsonResponse({ error: 'falha ao abrir portal' }, 500)
  }
})
