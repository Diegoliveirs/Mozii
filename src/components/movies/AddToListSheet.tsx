import { useState } from 'react'
import type { MovieRef } from '../../domain/types'
import { useAddToList, useCreateList, useLists } from '../../hooks/useLists'
import { t } from '../../lib/i18n'

export function AddToListSheet({ movie, onClose }: { movie: MovieRef; onClose: () => void }) {
  const { data: lists } = useLists()
  const addToList = useAddToList()
  const createList = useCreateList()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(listId: string, listName: string) {
    setError(null)
    try {
      await addToList.mutateAsync({ listId, listName, movie })
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg.includes('duplicate') ? t.movies.duplicate : t.common.error)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const list = await createList.mutateAsync(newName.trim())
    setNewName('')
    await handleAdd(list.id, list.name)
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="sheet-in w-full max-w-md rounded-t-3xl bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
        <p className="mb-4 text-sm font-medium text-snow">
          {t.movies.addToList}: <span className="text-ash">{movie.title}</span>
        </p>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {lists?.map((list) => (
            <button
              key={list.id}
              onClick={() => handleAdd(list.id, list.name)}
              disabled={addToList.isPending}
              className="flex w-full items-center justify-between rounded-xl bg-overlay px-4 py-3 text-left text-sm text-snow disabled:opacity-60"
            >
              {list.name}
              <span className="text-xs text-ash">
                {list.itemCount} {t.movies.movies}
              </span>
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-rose-soft">{error}</p>}
        <form onSubmit={handleCreate} className="mt-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.movies.listName}
            className="flex-1 rounded-xl border border-line-strong bg-night px-4 py-2.5 text-base text-snow placeholder-ash outline-none focus:border-rose"
          />
          <button
            type="submit"
            disabled={!newName.trim() || createList.isPending}
            className="rounded-xl bg-rose px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {t.movies.create}
          </button>
        </form>
      </div>
    </div>
  )
}
