import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDeleteList, useListItems, useRemoveFromList, useSetWatched, useLists } from '../hooks/useLists'
import { useCouple } from '../hooks/useCouple'
import { Poster } from '../components/movies/Poster'
import { ProfileAvatar } from '../components/feed/ProfileAvatar'
import { MovieSearchSheet } from '../components/movies/MovieSearchSheet'
import { RandomPickModal } from '../components/movies/RandomPickModal'
import { PageHeader } from '../components/layout/PageHeader'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { t } from '../lib/i18n'

export function ListDetailPage() {
  const { listId = '' } = useParams()
  const navigate = useNavigate()
  const { data: lists } = useLists()
  const { data: items, isLoading } = useListItems(listId)
  const { data: coupleData } = useCouple()
  const setWatched = useSetWatched(listId)
  const removeItem = useRemoveFromList(listId)
  const deleteList = useDeleteList()
  const [showSearch, setShowSearch] = useState(false)
  const [showRandom, setShowRandom] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const list = lists?.find((l) => l.id === listId)
  const members = coupleData?.members ?? []

  async function handleDeleteList() {
    await deleteList.mutateAsync(listId)
    navigate('/cinema?aba=listas')
  }

  return (
    <div>
      <PageHeader
        title={list?.name ?? '…'}
        backTo="/cinema?aba=listas"
        action={
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label={t.common.delete}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-rose-soft transition-transform active:scale-90"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
            </svg>
          </button>
        }
      />
      <div className="px-4">
      <p className="pb-3 text-xs text-ash">
        {items?.length ?? 0} {t.movies.movies}
      </p>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setShowSearch(true)}
          className="flex-1 rounded-xl bg-rose py-2.5 text-sm font-medium text-white transition-transform active:scale-[0.97]"
        >
          + Adicionar filme
        </button>
        <button
          onClick={() => setShowRandom(true)}
          disabled={!items || items.every((i) => i.watched)}
          className="flex-1 rounded-xl border border-line-strong bg-card py-2.5 text-sm font-medium text-snow transition-transform active:scale-[0.97] disabled:opacity-40"
        >
          🎲 O que ver hoje
        </button>
      </div>

      {isLoading && <p className="pt-8 text-center text-sm text-ash">{t.common.loading}</p>}
      {items?.length === 0 && (
        <p className="pt-12 text-center text-sm text-ash">{t.movies.emptyList}</p>
      )}

      <ul className="divide-y divide-line">
        {items?.map((item) => {
          const adderIndex = members.findIndex((m) => m.id === item.addedBy)
          const adder = members[adderIndex]
          return (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <Link to={`/filme/${item.movie.tmdbId}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Poster posterPath={item.movie.posterPath} title={item.movie.title} size="md" />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${item.watched ? 'text-ash line-through' : 'text-snow'}`}>
                    {item.movie.title}
                  </p>
                  {item.movie.releaseYear && <p className="text-xs text-ash">{item.movie.releaseYear}</p>}
                  {adder && (
                    <span className="mt-1 flex items-center gap-1.5">
                      <ProfileAvatar profile={adder} index={Math.max(adderIndex, 0)} size="sm" />
                      <span className="text-[11px] text-ash">{adder.displayName} adicionou</span>
                    </span>
                  )}
                </div>
              </Link>
              <button
                onClick={() => setWatched.mutate({ itemId: item.id, watched: !item.watched })}
                aria-label={t.movies.watched}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  item.watched ? 'border-rose bg-rose/15 text-rose-soft' : 'border-line-strong text-ash'
                }`}
              >
                ✓
              </button>
              <button
                onClick={() => removeItem.mutate(item.id)}
                aria-label={t.common.delete}
                className="text-ash"
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>

      {showSearch && list && (
        <MovieSearchSheet listId={list.id} listName={list.name} onClose={() => setShowSearch(false)} />
      )}
      {showRandom && items && <RandomPickModal items={items} onClose={() => setShowRandom(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          message={`Excluir a lista "${list?.name}"? Os filmes dela somem para os dois.`}
          onConfirm={handleDeleteList}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      </div>
    </div>
  )
}
