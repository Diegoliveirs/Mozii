import { Link } from 'react-router-dom'
import { t } from '../../lib/i18n'

// distribuição de notas (1–5; meia estrela junta com a cheia de baixo).
// Extraído do antigo StatsSection. Premium vê; free ganha o teaser.
export function RatingsHistogram({ ratings, isPremium }: { ratings: number[]; isPremium: boolean }) {
  if (!isPremium) {
    return (
      <Link
        to="/premium"
        className="flex items-center gap-2 rounded-2xl bg-card p-4 text-xs text-ash transition-transform active:scale-[0.98]"
      >
        <span aria-hidden="true">🔒</span>
        <span className="flex-1">{t.stats.locked}</span>
        <span className="text-rose-soft">›</span>
      </Link>
    )
  }

  const buckets = [1, 2, 3, 4, 5].map((star) => ratings.filter((r) => Math.ceil(r) === star).length)
  const maxBucket = Math.max(1, ...buckets)

  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="mb-2 text-xs text-ash">{t.stats.distribution}</p>
      <div className="flex items-end gap-1.5" style={{ height: 56 }}>
        {buckets.map((count, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-sm bg-rose/70"
              style={{ height: `${Math.max(4, (count / maxBucket) * 44)}px` }}
            />
            <span className="text-[10px] text-ash">{i + 1}★</span>
          </div>
        ))}
      </div>
    </div>
  )
}
