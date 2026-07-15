import { useEffect } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { MovieRef } from '../domain/types'
import { useRepositories } from '../data/RepositoriesContext'
import { useMyProfile } from './useCouple'

export function useFeedInfinite() {
  const { feed } = useRepositories()
  const { data: profile } = useMyProfile()
  const coupleId = profile?.coupleId
  const qc = useQueryClient()

  useEffect(() => {
    if (!coupleId || !feed.subscribeToFeed) return
    return feed.subscribeToFeed(coupleId, () => {
      qc.invalidateQueries({ queryKey: ['feed', coupleId] })
    })
  }, [coupleId, feed, qc])

  return useInfiniteQuery({
    queryKey: ['feed', coupleId],
    queryFn: ({ pageParam }) => feed.getFeedPage(coupleId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!coupleId,
  })
}

export function usePost(postId: string) {
  const { feed } = useRepositories()
  return useQuery({
    queryKey: ['post', postId],
    queryFn: () => feed.getPost(postId),
    enabled: !!postId,
  })
}

export function useCreatePost() {
  const { feed, storage } = useRepositories()
  const { data: profile } = useMyProfile()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ body, photo }: { body: string; photo?: Blob }) => {
      const coupleId = profile!.coupleId!
      let photoPath: string | undefined
      if (photo) photoPath = await storage.uploadPhoto(coupleId, photo)
      return feed.createPost({ coupleId, body, photoPath })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  })
}

export function useCreateReview() {
  const { feed } = useRepositories()
  const { data: profile } = useMyProfile()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ movie, rating, body }: { movie: MovieRef; rating: number; body: string }) =>
      feed.createReview({ coupleId: profile!.coupleId!, movie, rating, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['movie-reviews'] })
      qc.invalidateQueries({ queryKey: ['review-stats'] })
    },
  })
}

export function useDeletePost() {
  const { feed } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => feed.deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['movie-reviews'] })
      qc.invalidateQueries({ queryKey: ['review-stats'] })
    },
  })
}

export function useMovieReviews(tmdbId: number) {
  const { feed } = useRepositories()
  const { data: profile } = useMyProfile()
  const coupleId = profile?.coupleId
  return useQuery({
    queryKey: ['movie-reviews', coupleId, tmdbId],
    queryFn: () => feed.getMovieReviews(coupleId!, tmdbId),
    enabled: !!coupleId && Number.isFinite(tmdbId),
  })
}

export function useUpdateReview() {
  const { feed } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, rating, body }: { postId: string; rating: number; body: string }) =>
      feed.updateReview(postId, rating, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['movie-reviews'] })
      qc.invalidateQueries({ queryKey: ['review-stats'] })
    },
  })
}

export function usePhotoUrl(photoPath: string | null) {
  const { storage } = useRepositories()
  return useQuery({
    queryKey: ['photo-url', photoPath],
    queryFn: () => storage.getPhotoUrl(photoPath!),
    enabled: !!photoPath,
    staleTime: 45 * 60_000,
  })
}
