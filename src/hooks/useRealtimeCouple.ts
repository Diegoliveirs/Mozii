import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '../data/RepositoriesContext'
import { useMyProfile } from './useCouple'

// invalidação por prefixo: atinge também keys que espalham ids
// (ex.: ['reactions', ...postIds])
const INVALIDATE_BY_TABLE: Record<string, string[]> = {
  posts: ['feed', 'post', 'movie-reviews', 'review-stats', 'comment-counts'],
  comments: ['comments', 'comment-counts'],
  reactions: ['reactions'],
  lists: ['lists', 'lists-containing'],
  list_items: ['list-items', 'lists', 'lists-containing'],
  moments: ['moments'],
}

// Assina os eventos do casal (posts, comentários, reações, listas) uma única
// vez no AppShell e invalida as queries certas — o React Query refaz o fetch
// das que estão montadas, em qualquer página.
export function useRealtimeCouple() {
  const { feed } = useRepositories()
  const { data: profile } = useMyProfile()
  const coupleId = profile?.coupleId
  const qc = useQueryClient()

  useEffect(() => {
    if (!coupleId || !feed.subscribeToCouple) return
    return feed.subscribeToCouple(coupleId, (table) => {
      for (const key of INVALIDATE_BY_TABLE[table] ?? []) {
        qc.invalidateQueries({ queryKey: [key] })
      }
    })
  }, [coupleId, feed, qc])
}
