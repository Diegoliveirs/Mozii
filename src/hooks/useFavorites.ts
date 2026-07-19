import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MovieRef } from '../domain/types'
import { useRepositories } from '../data/RepositoriesContext'
import { useMyProfile } from './useCouple'

export function useFavorites(profileId: string | undefined) {
  const { favorites } = useRepositories()
  return useQuery({
    queryKey: ['favorites', profileId],
    queryFn: () => favorites.getFavorites(profileId!),
    enabled: !!profileId,
  })
}

export function useAddFavorite() {
  const { favorites } = useRepositories()
  const { data: profile } = useMyProfile()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ movie, position }: { movie: MovieRef; position: number }) =>
      favorites.addFavorite(profile!.coupleId!, movie, position),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  })
}

export function useRemoveFavorite() {
  const { favorites } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tmdbId: number) => favorites.removeFavorite(tmdbId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  })
}
