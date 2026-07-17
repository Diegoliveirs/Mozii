import Stripe from 'npm:stripe@17'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export function getStripe(): Stripe {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('STRIPE_SECRET_KEY ausente')
  // httpClient Fetch é obrigatório no Deno (o default usa Node http)
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() })
}

/** Client com service-role: bypassa RLS. Usado para gravar/ler assinaturas. */
export function getAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

/** Resolve o usuário logado a partir do header Authorization da request. */
export async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? ''
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  )
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return data.user
}

/**
 * couple_id do usuário logado, resolvido SERVER-SIDE via profiles (admin client).
 * Nunca aceitar couple_id do body: na v1 um metadata errado gerou assinatura
 * paga sem registro no banco.
 */
export async function getCoupleId(userId: string): Promise<string | null> {
  const admin = getAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('couple_id')
    .eq('id', userId)
    .maybeSingle()
  return (data?.couple_id as string | null) ?? null
}

/** Mapa price_id do Stripe → nome do plano interno (weekly/monthly/lifetime). */
export function planForPrice(priceId: string | null | undefined): string | null {
  if (!priceId) return null
  const map: Record<string, string> = {
    [Deno.env.get('STRIPE_PRICE_WEEKLY') ?? '']: 'weekly',
    [Deno.env.get('STRIPE_PRICE_MONTHLY') ?? '']: 'monthly',
    [Deno.env.get('STRIPE_PRICE_LIFETIME') ?? '']: 'lifetime',
  }
  return map[priceId] ?? null
}

/** Nome do plano → price_id + modo de checkout. */
export function priceForPlan(plan: string): { price: string; mode: 'subscription' | 'payment' } | null {
  switch (plan) {
    case 'weekly':
      return { price: Deno.env.get('STRIPE_PRICE_WEEKLY') ?? '', mode: 'subscription' }
    case 'monthly':
      return { price: Deno.env.get('STRIPE_PRICE_MONTHLY') ?? '', mode: 'subscription' }
    case 'lifetime':
      return { price: Deno.env.get('STRIPE_PRICE_LIFETIME') ?? '', mode: 'payment' }
    default:
      return null
  }
}
