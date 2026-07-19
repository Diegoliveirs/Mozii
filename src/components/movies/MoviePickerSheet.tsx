import { useState } from 'react'
import type { MovieRef } from '../../domain/types'
import { useTmdbSearch } from '../../hooks/useTmdbSearch'
import { Poster } from './Poster'
import { t } from '../../lib/i18n'

// picker genérico de filme (reaproveita o padrão do MovieSearchSheet, mas
// devolve o filme escolhido via onPick em vez de acoplar a uma lista)
export function MoviePickerSheet({
  title,
  onPick,
  onClose,
}: {
  title: string
  onPick: (movie: MovieRef) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const { data: results, isLoading } = useTmdbSearch(query)

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="sheet-in flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
        <p className="mb-3 text-sm font-medium text-snow">{title}</p>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.movies.searchPlaceholder}
          className="w-full rounded-xl border border-line-strong bg-night px-4 py-3 text-base text-snow placeholder-ash outline-none focus:border-rose"
        />
        {isLoading && <p className="pt-4 text-center text-sm text-ash">{t.common.loading}</p>}
        <ul className="mt-2 divide-y divide-line overflow-y-auto">
          {results?.map((movie) => (
            <li key={movie.tmdbId}>
              <button
                onClick={() => onPick(movie)}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <Poster posterPath={movie.posterPath} title={movie.title} size="sm" />
                <span className="min-w-0 flex-1 text-sm text-snow">
                  {movie.title}{' '}
                  {movie.releaseYear && <span className="text-ash">{movie.releaseYear}</span>}
                </span>
                <span className="text-lg text-rose">+</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
