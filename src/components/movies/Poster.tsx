import { posterUrl } from '../../api/tmdb'

const SIZES = { sm: 'h-16 w-11', md: 'h-24 w-16', lg: 'h-32 w-21', xl: 'h-44 w-30' } as const

export function Poster({
  posterPath,
  title,
  size = 'md',
  className = '',
}: {
  posterPath: string | null
  title: string
  size?: keyof typeof SIZES
  className?: string
}) {
  const url = posterUrl(posterPath)
  return url ? (
    <img
      src={url}
      alt={title}
      loading="lazy"
      className={`${SIZES[size]} shrink-0 rounded-lg object-cover ${className}`}
    />
  ) : (
    <div
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-lg bg-overlay p-1 text-center text-[10px] text-ash ${className}`}
    >
      {title}
    </div>
  )
}
