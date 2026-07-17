import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PremiumPlan } from '../domain/types'
import { useRepositories } from '../data/RepositoriesContext'
import { useMyProfile } from './useCouple'

/**
 * Estado premium do espaço. Sem realtime: staleTime 0 + refetchOnWindowFocus
 * cobrem o dia a dia; `poll` liga um refetch de 2s enquanto o app espera o
 * webhook do Stripe gravar (pós-checkout / pós-cancelamento).
 * O banco (RLS + has_premium) é quem bloqueia de verdade — isto é só exibição.
 */
export function useEntitlement(poll = false) {
  const { billing } = useRepositories()
  const { data: profile } = useMyProfile()
  return useQuery({
    queryKey: ['entitlement'],
    queryFn: () => billing.getEntitlement(),
    enabled: Boolean(profile?.coupleId), // só faz sentido com espaço
    staleTime: 0, // sobrepõe o default global de 30s — focus sempre revalida
    refetchInterval: poll ? 2_000 : false,
  })
}

export function useCreateCheckout() {
  const { billing } = useRepositories()
  return useMutation({ mutationFn: (plan: PremiumPlan) => billing.createCheckoutSession(plan) })
}

export function useCancelSubscription() {
  const { billing } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => billing.cancelSubscription(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entitlement'] }),
  })
}

export function useResumeSubscription() {
  const { billing } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => billing.resumeSubscription(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entitlement'] }),
  })
}

export function useOpenPortal() {
  const { billing } = useRepositories()
  return useMutation({ mutationFn: () => billing.openPortal() })
}
