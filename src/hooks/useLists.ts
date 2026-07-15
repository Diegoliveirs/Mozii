import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MovieRef } from '../domain/types'
import { useRepositories } from '../data/RepositoriesContext'
import { useMyProfile } from './useCouple'

export function useLists() {
  const { lists } = useRepositories()
  const { data: profile } = useMyProfile()
  const coupleId = profile?.coupleId
  return useQuery({
    queryKey: ['lists', coupleId],
    queryFn: () => lists.getLists(coupleId!),
    enabled: !!coupleId,
  })
}

export function useListItems(listId: string) {
  const { lists } = useRepositories()
  return useQuery({
    queryKey: ['list-items', listId],
    queryFn: () => lists.getItems(listId),
    enabled: !!listId,
  })
}

export function useCreateList() {
  const { lists } = useRepositories()
  const { data: profile } = useMyProfile()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => lists.createList(profile!.coupleId!, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  })
}

export function useAddToList() {
  const { lists } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ listId, listName, movie }: { listId: string; listName: string; movie: MovieRef }) =>
      lists.addItem(listId, listName, movie),
    onSuccess: (_data, { listId }) => {
      qc.invalidateQueries({ queryKey: ['lists'] })
      qc.invalidateQueries({ queryKey: ['list-items', listId] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['lists-containing'] })
    },
  })
}

export function useRemoveFromList(listId: string) {
  const { lists } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => lists.removeItem(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists'] })
      qc.invalidateQueries({ queryKey: ['list-items', listId] })
    },
  })
}

export function useSetWatched(listId: string) {
  const { lists } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, watched }: { itemId: string; watched: boolean }) =>
      lists.setWatched(itemId, watched),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists'] })
      qc.invalidateQueries({ queryKey: ['list-items', listId] })
    },
  })
}

export function useListsContaining(tmdbId: number) {
  const { lists } = useRepositories()
  const { data: profile } = useMyProfile()
  const coupleId = profile?.coupleId
  return useQuery({
    queryKey: ['lists-containing', coupleId, tmdbId],
    queryFn: () => lists.getListsContaining(coupleId!, tmdbId),
    enabled: !!coupleId && Number.isFinite(tmdbId),
  })
}

export function useDeleteList() {
  const { lists } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (listId: string) => lists.deleteList(listId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  })
}
