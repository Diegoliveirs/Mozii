import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Favorite, MovieRef } from '../../domain/types'
import { posterUrl } from '../../api/tmdb'
import { MoviePickerSheet } from '../movies/MoviePickerSheet'
import { useAddFavorite, useRemoveFavorite } from '../../hooks/useFavorites'
import { t } from '../../lib/i18n'

const MAX = 5

function FavPoster({ movie }: { movie: MovieRef }) {
  const url = movie.posterPath ? posterUrl(movie.posterPath, 'w185') : null
  return url ? (
    <img src={url} alt={movie.title} className="aspect-[2/3] w-full rounded-lg object-cover" />
  ) : (
    <div className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-overlay p-1 text-center text-[9px] text-ash">
      {movie.title}
    </div>
  )
}

export function FavoritesRow({ favorites, editable }: { favorites: Favorite[]; editable: boolean }) {
  const add = useAddFavorite()
  const remove = useRemoveFavorite()
  const [picking, setPicking] = useState(false)

  const sorted = [...favorites].sort((a, b) => a.position - b.position)

  async function pick(movie: MovieRef) {
    setPicking(false)
    if (sorted.some((f) => f.movie.tmdbId === movie.tmdbId)) return
    await add.mutateAsync({ movie, position: sorted.length })
  }

  return (
    <div>
      <p className="mb-2 text-xs text-ash">{t.profile.favorites}</p>
      <div className="grid grid-cols-5 gap-2">
        {sorted.map((fav) => (
          <div key={fav.id} className="relative">
            <Link to={`/filme/${fav.movie.tmdbId}`}>
              <FavPoster movie={fav.movie} />
            </Link>
            {editable && (
              <button
                onClick={() => remove.mutate(fav.movie.tmdbId)}
                aria-label="Remover favorito"
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {editable && sorted.length < MAX && (
          <button
            onClick={() => setPicking(true)}
            aria-label={t.profile.addFavorite}
            className="flex aspect-[2/3] w-full items-center justify-center rounded-lg border border-dashed border-line-strong text-xl text-ash transition-transform active:scale-95"
          >
            +
          </button>
        )}
        {!editable && sorted.length === 0 && (
          <p className="col-span-5 py-4 text-center text-xs text-ash">—</p>
        )}
      </div>
      {picking && (
        <MoviePickerSheet title={t.profile.pickFavorite} onPick={pick} onClose={() => setPicking(false)} />
      )}
    </div>
  )
}
