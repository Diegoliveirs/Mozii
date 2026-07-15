import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '../data/RepositoriesContext'
import { useMyProfile } from './useCouple'
import { resizePhoto } from '../lib/image'

export function useUpdateDisplayName() {
  const { couple } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => couple.updateDisplayName(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['couple'] })
    },
  })
}

export function useUpdateAvatar() {
  const { couple, storage } = useRepositories()
  const { data: profile } = useMyProfile()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const blob = await resizePhoto(file, 400)
      const path = await storage.uploadPhoto(profile!.coupleId!, blob)
      await couple.updateAvatar(path)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['couple'] })
    },
  })
}

export function useReviewStats() {
  const { feed } = useRepositories()
  const { data: profile } = useMyProfile()
  const coupleId = profile?.coupleId
  return useQuery({
    queryKey: ['review-stats', coupleId],
    queryFn: () => feed.getReviewStats(coupleId!),
    enabled: !!coupleId,
  })
}
