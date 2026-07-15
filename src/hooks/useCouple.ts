import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '../data/RepositoriesContext'

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
    onSuccess: () => {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['couple'] })
    },
  })
}
