import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ListItem } from '../../domain/types'
import { Poster } from './Poster'

export function RandomPickModal({ items, onClose }: { items: ListItem[]; onClose: () => void }) {
  const unwatched = items.filter((i) => !i.watched)
  const pickRandom = useCallback(
    () => unwatched[Math.floor(Math.random() * unwatched.length)] ?? null,
    [unwatched],
  )
  const [pick, setPick] = useState<ListItem | null>(pickRandom)

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-8" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-3xl bg-card p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-sm font-medium text-snow">O que ver hoje 🎬</p>
        {pick ? (
          <>
            <Link to={`/filme/${pick.movie.tmdbId}`} className="inline-block">
              <Poster posterPath={pick.movie.posterPath} title={pick.movie.title} size="xl" className="mx-auto" />
              <p className="mt-3 text-base font-medium text-snow">{pick.movie.title}</p>
              {pick.movie.releaseYear && <p className="text-xs text-ash">{pick.movie.releaseYear}</p>}
            </Link>
            <button
              onClick={() => setPick(pickRandom())}
              className="mt-5 w-full rounded-xl bg-rose py-3 text-sm font-medium text-white"
            >
              Sortear de novo
            </button>
          </>
        ) : (
          <p className="text-sm text-ash">Nenhum filme não visto nesta lista.</p>
        )}
        <button onClick={onClose} className="mt-2 w-full py-2 text-sm text-ash">
          Fechar
        </button>
      </div>
    </div>
  )
}
