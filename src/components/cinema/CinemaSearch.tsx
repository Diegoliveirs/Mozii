import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTmdbSearch } from '../../hooks/useTmdbSearch'
import { Poster } from '../movies/Poster'
import { t } from '../../lib/i18n'

export function CinemaSearch() {
  const [query, setQuery] = useState('')
  const { data: results, isLoading, isError } = useTmdbSearch(query)

  return (
    <div>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.movies.searchPlaceholder}
        className="w-full rounded-xl border border-line-strong bg-card px-4 py-3 text-base text-snow placeholder-ash outline-none focus:border-rose"
      />

      {isLoading && <p className="pt-8 text-center text-sm text-ash">{t.common.loading}</p>}
      {isError && <p className="pt-8 text-center text-sm text-rose-soft">{t.common.error}</p>}

      <ul className="divide-y divide-line">
        {results?.map((movie) => (
          <li key={movie.tmdbId}>
            <Link to={`/filme/${movie.tmdbId}`} className="flex gap-3 py-3">
              <Poster posterPath={movie.posterPath} title={movie.title} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-snow">
                  {movie.title}{' '}
                  {movie.releaseYear && <span className="font-normal text-ash">{movie.releaseYear}</span>}
                </p>
                {movie.overview && (
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ash">{movie.overview}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
