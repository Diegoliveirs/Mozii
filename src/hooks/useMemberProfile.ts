import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useRepositories } from '../data/RepositoriesContext'
import { useMyProfile } from './useCouple'

// feed pessoal: só a atividade (posts, reviews, atividades) do membro
export function useMemberFeed(memberId: string | undefined) {
  const { feed } = useRepositories()
  const { data: profile } = useMyProfile()
  const coupleId = profile?.coupleId
  return useInfiniteQuery({
    queryKey: ['member-feed', coupleId, memberId],
    queryFn: ({ pageParam }) => feed.getFeedPage(coupleId!, pageParam, 20, memberId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!coupleId && !!memberId,
  })
}

// reviews recentes do membro (grade de pôsteres + estrelas)
export function useMemberReviews(memberId: string | undefined) {
  const { feed } = useRepositories()
  const { data: profile } = useMyProfile()
  const coupleId = profile?.coupleId
  return useQuery({
    queryKey: ['member-reviews', coupleId, memberId],
    queryFn: () => feed.getMemberReviews(coupleId!, memberId!),
    enabled: !!coupleId && !!memberId,
  })
}
