import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Couple, Profile } from '../domain/types'
import { useRepositories } from '../data/RepositoriesContext'

function applyCoupleToProfileCache(qc: ReturnType<typeof useQueryClient>, couple: Couple) {
  // grava o coupleId direto no cache: evita o guard devolver para /parear
  // enquanto o refetch do perfil ainda está em voo
  qc.setQueryData<Profile | null>(['profile'], (old) => (old ? { ...old, coupleId: couple.id } : old))
}

export function useMyProfile() {
  const { couple } = useRepositories()
  return useQuery({ queryKey: ['profile'], queryFn: () => couple.getMyProfile() })
}

export function useCouple() {
  const { couple } = useRepositories()
  return useQuery({ queryKey: ['couple'], queryFn: () => couple.getCouple() })
}

export function useCreateCouple() {
  const { couple } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => couple.createCouple(),
    onSuccess: (created) => {
      applyCoupleToProfileCache(qc, created)
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['couple'] })
    },
  })
}

export function useJoinCouple() {
  const { couple } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => couple.joinCouple(code),
    onSuccess: (joined) => {
      applyCoupleToProfileCache(qc, joined)
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['couple'] })
    },
  })
}
