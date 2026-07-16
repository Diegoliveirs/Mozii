import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Comment, Reaction } from '../domain/types'
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

export function useCommentCounts(postIds: string[]) {
  const { feed } = useRepositories()
  return useQuery({
    queryKey: ['comment-counts', ...postIds],
    queryFn: () => feed.getCommentCounts(postIds),
    enabled: postIds.length > 0,
  })
}

export function useAddComment(postId: string) {
  const { feed } = useRepositories()
  const { data: profile } = useMyProfile()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => feed.addComment(postId, body),
    // otimismo espelhado no useToggleReaction: aparece na hora, reverte em erro
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ['comments', postId] })
      const snapshot = qc.getQueryData<Comment[]>(['comments', postId])
      if (profile) {
        qc.setQueryData<Comment[]>(['comments', postId], (old) => [
          ...(old ?? []),
          {
            id: `otimista-${Date.now()}`,
            postId,
            authorId: profile.id,
            body,
            createdAt: new Date().toISOString(),
          },
        ])
      }
      return { snapshot }
    },
    onError: (_err, _body, ctx) => {
      if (ctx && ctx.snapshot !== undefined) qc.setQueryData(['comments', postId], ctx.snapshot)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] })
      qc.invalidateQueries({ queryKey: ['comment-counts'] })
    },
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
