import { useId } from 'react'

function Star({ fill }: { fill: number }) {
  // useId() traz ':' — inválido em url(#) de SVG; removemos para um id seguro
  const id = `star-${useId().replace(/:/g, '')}`
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="var(--color-star)" />
          <stop offset={`${fill * 100}%`} stopColor="var(--color-star-off)" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 17.3l-6.2 3.4 1.2-6.9-5-4.9 6.9-1L12 1.6l3.1 6.3 6.9 1-5 4.9 1.2 6.9z"
      />
    </svg>
  )
}

export function StarRating({
  value,
  onChange,
  size = 'text-xl',
}: {
  value: number
  onChange?: (v: number) => void
  size?: string
}) {
  const stars = [1, 2, 3, 4, 5]

  if (!onChange) {
    return (
      <span className={`inline-flex gap-0.5 ${size}`} aria-label={`${value} de 5 estrelas`}>
        {stars.map((s) => (
          <Star key={s} fill={Math.min(Math.max(value - s + 1, 0), 1)} />
        ))}
      </span>
    )
  }

  return (
    <span className={`inline-flex gap-0.5 ${size}`} role="radiogroup" aria-label="Avaliação">
      {stars.map((s) => (
        <button
          key={s}
          type="button"
          className="relative"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const half = e.clientX - rect.left < rect.width / 2
            onChange(half ? s - 0.5 : s)
          }}
          aria-label={`${s} estrelas`}
        >
          <Star fill={Math.min(Math.max(value - s + 1, 0), 1)} />
        </button>
      ))}
    </span>
  )
}
