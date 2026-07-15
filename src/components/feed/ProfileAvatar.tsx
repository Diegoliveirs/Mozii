import type { Profile } from '../../domain/types'
import { usePhotoUrl } from '../../hooks/useFeed'

const COLORS = ['bg-rose', 'bg-[#534ab7]']
const SIZES = { sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-xs', lg: 'h-20 w-20 text-2xl' } as const

export function ProfileAvatar({
  profile,
  index = 0,
  size = 'md',
}: {
  profile: Profile | undefined
  index?: number
  size?: keyof typeof SIZES
}) {
  const { data: url } = usePhotoUrl(profile?.avatarUrl ?? null)

  if (url) {
    return (
      <img
        src={url}
        alt={profile?.displayName ?? ''}
        className={`${SIZES[size]} shrink-0 rounded-full object-cover`}
      />
    )
  }
  return (
    <span
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-full font-medium text-white ${COLORS[index % COLORS.length]}`}
    >
      {(profile?.displayName ?? '?').slice(0, 1).toUpperCase()}
    </span>
  )
}
