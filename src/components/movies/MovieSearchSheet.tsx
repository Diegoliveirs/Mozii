import { useState } from 'react'
import { useTmdbSearch } from '../../hooks/useTmdbSearch'
import { useAddToList } from '../../hooks/useLists'
import { Poster } from './Poster'
import { t } from '../../lib/i18n'

export function MovieSearchSheet({
  listId,
  listName,
  onClose,
}: {
  listId: string
  listName: string
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const { data: results, isLoading } = useTmdbSearch(query)
  const addToList = useAddToList()
  const [error, setError] = useState<string | null>(null)
  const [addedId, setAddedId] = useState<number | null>(null)

  async function handleAdd(movie: NonNullable<typeof results>[number]) {
    setError(null)
    try {
      await addToList.mutateAsync({ listId, listName, movie })
      setAddedId(movie.tmdbId)
      setTimeout(onClose, 400)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg.includes('duplicate') ? t.movies.duplicate : t.common.error)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="sheet-in flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
        <p className="mb-3 text-sm font-medium text-snow">
          Adicionar a <span className="text-ash">{listName}</span>
        </p>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.movies.searchPlaceholder}
          className="w-full rounded-xl border border-line-strong bg-night px-4 py-3 text-sm text-snow placeholder-ash outline-none focus:border-rose"
        />
        {error && <p className="mt-2 text-sm text-rose-soft">{error}</p>}
        {isLoading && <p className="pt-4 text-center text-sm text-ash">{t.common.loading}</p>}
        <ul className="mt-2 divide-y divide-line overflow-y-auto">
          {results?.map((movie) => (
            <li key={movie.tmdbId}>
              <button
                onClick={() => handleAdd(movie)}
                disabled={addToList.isPending}
                className="flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-60"
              >
                <Poster posterPath={movie.posterPath} title={movie.title} size="sm" />
                <span className="min-w-0 flex-1 text-sm text-snow">
                  {movie.title}{' '}
                  {movie.releaseYear && <span className="text-ash">{movie.releaseYear}</span>}
                </span>
                <span className="text-lg text-rose">{addedId === movie.tmdbId ? '✓' : '+'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
