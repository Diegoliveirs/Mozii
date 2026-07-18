import { FunctionsHttpError } from '@supabase/supabase-js'
import type { BillingRepository } from '../repositories'
import type { Entitlement, PremiumPlan } from '../../domain/types'
import { supabase } from './client'

/** FunctionsHttpError esconde o corpo no context — extrai a mensagem real. */
async function toError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null)
    return new Error(body?.error ?? 'Falha ao falar com o servidor')
  }
  return error instanceof Error ? error : new Error(String(error))
}

export class SupabaseBillingRepository implements BillingRepository {
  async getEntitlement(): Promise<Entitlement> {
    const { data, error } = await supabase.rpc('get_entitlement')
    if (error) throw error
    return {
      isPremium: data?.is_premium === true,
      trialEndsAt: data?.trial_ends_at ?? null,
      plan: (data?.plan as PremiumPlan | null) ?? null,
      status: data?.status ?? null,
      isLifetime: data?.is_lifetime === true,
      currentPeriodEnd: data?.current_period_end ?? null,
      priceAmount: data?.price_amount ?? null,
      currency: data?.currency ?? null,
      cancelAtPeriodEnd: data?.cancel_at_period_end === true,
    }
  }

  async createCheckoutSession(plan: PremiumPlan): Promise<{ clientSecret: string }> {
    const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { plan } })
    if (error) throw await toError(error)
    if (!data?.clientSecret) throw new Error('Checkout sem client_secret')
    return { clientSecret: data.clientSecret }
  }

  async cancelSubscription(): Promise<void> {
    const { error } = await supabase.functions.invoke('stripe-cancel', { body: { action: 'cancel' } })
    if (error) throw await toError(error)
  }

  async resumeSubscription(): Promise<void> {
    const { error } = await supabase.functions.invoke('stripe-cancel', { body: { action: 'resume' } })
    if (error) throw await toError(error)
  }

  async openPortal(): Promise<{ url: string }> {
    const { data, error } = await supabase.functions.invoke('stripe-portal', { body: {} })
    if (error) throw await toError(error)
    if (!data?.url) throw new Error('Portal sem URL')
    return { url: data.url }
  }
}
