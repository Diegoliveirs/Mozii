import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Reaction } from '../domain/types'
import { useRepositories } from '../data/RepositoriesContext'
import { useMyProfile } from './useCouple'

export function useComments(postId: string) {
  const { feed } = useRepositories()
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: () => feed.getComments(postId),
    enabled: !!postId,
  })
}

export function useAddComment(postId: string) {
  const { feed } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => feed.addComment(postId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', postId] }),
  })
}

export function useReactions(postIds: string[]) {
  const { feed } = useRepositories()
  return useQuery({
    queryKey: ['reactions', ...postIds],
    queryFn: () => feed.getReactions(postIds),
    enabled: postIds.length > 0,
  })
}

export function useToggleReaction() {
  const { feed } = useRepositories()
  const { data: profile } = useMyProfile()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, emoji }: { postId: string; emoji: string }) =>
      feed.toggleReaction(postId, emoji),
    onMutate: async ({ postId, emoji }) => {
      await qc.cancelQueries({ queryKey: ['reactions'] })
      const snapshots = qc.getQueriesData<Record<string, Reaction[]>>({ queryKey: ['reactions'] })
      qc.setQueriesData<Record<string, Reaction[]>>({ queryKey: ['reactions'] }, (old) => {
        if (!old || !(postId in old) || !profile) return old
        const mine = old[postId].find((r) => r.authorId === profile.id && r.emoji === emoji)
        const next = mine
          ? old[postId].filter((r) => r.id !== mine.id)
          : [
              ...old[postId],
              {
                id: `otimista-${Date.now()}`,
                postId,
                authorId: profile.id,
                emoji,
                createdAt: new Date().toISOString(),
              },
            ]
        return { ...old, [postId]: next }
      })
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['reactions'] }),
  })
}
