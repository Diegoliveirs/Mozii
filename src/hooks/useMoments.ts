import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '../data/RepositoriesContext'
import { useMyProfile } from './useCouple'
import { resizePhoto } from '../lib/image'

export function useMoments() {
  const { moments } = useRepositories()
  const { data: profile } = useMyProfile()
  const coupleId = profile?.coupleId
  return useQuery({
    queryKey: ['moments', coupleId],
    queryFn: () => moments.getMoments(coupleId!),
    enabled: !!coupleId,
  })
}

export function useCreateMoment() {
  const { moments, storage } = useRepositories()
  const { data: profile } = useMyProfile()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      caption,
      happenedOn,
      photos,
    }: {
      caption: string | null
      happenedOn: string
      photos: File[]
    }) => {
      const coupleId = profile!.coupleId!
      const photoPaths: string[] = []
      for (const file of photos) {
        const blob = await resizePhoto(file)
        photoPaths.push(await storage.uploadPhoto(coupleId, blob))
      }
      return moments.createMoment({ coupleId, caption, happenedOn, photoPaths })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moments'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['member-feed'] })
    },
  })
}

export function useDeleteMoment() {
  const { moments } = useRepositories()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (momentId: string) => moments.deleteMoment(momentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moments'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['member-feed'] })
    },
  })
}
