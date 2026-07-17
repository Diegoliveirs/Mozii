import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCreateList, useLists } from '../hooks/useLists'
import { useEntitlement } from '../hooks/useEntitlements'
import { Paywall } from '../components/premium/Paywall'
import { posterUrl } from '../api/tmdb'
import { t } from '../lib/i18n'

const FREE_LIST_LIMIT = 3

export function ListsPage() {
  const { data: lists, isLoading } = useLists()
  const { data: ent } = useEntitlement()
  const createList = useCreateList()
  const [creating, setCreating] = useState(false)
  const [paywall, setPaywall] = useState(false)
  const [name, setName] = useState('')

  const atFreeLimit = !ent?.isPremium && (lists?.length ?? 0) >= FREE_LIST_LIMIT

  function handleNewList() {
    if (atFreeLimit) setPaywall(true)
    else setCreating(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createList.mutateAsync(name.trim())
      setName('')
      setCreating(false)
    } catch {
      // o banco recusa a 4ª lista free (RLS) — mostra o paywall, não o erro cru
      setCreating(false)
      setPaywall(true)
    }
  }

  return (
    <div className="px-4 pt-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-medium text-snow">Nossas listas</h1>
        <button
          onClick={handleNewList}
          aria-label={t.movies.newList}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-rose text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="mb-4 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.movies.listName}
            className="flex-1 rounded-xl border border-line-strong bg-card px-4 py-2.5 text-base text-snow placeholder-ash outline-none focus:border-rose"
          />
          <button
            type="submit"
            disabled={!name.trim() || createList.isPending}
            className="rounded-xl bg-rose px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {t.movies.create}
          </button>
        </form>
      )}

      {isLoading && <p className="pt-8 text-center text-sm text-ash">{t.common.loading}</p>}

      <div className="grid grid-cols-2 gap-3">
        {lists?.map((list) => (
          <Link
            key={list.id}
            to={`/listas/${list.id}`}
            className="rounded-2xl bg-card p-3 transition-transform active:scale-[0.97]"
          >
            <div className="mb-2 flex gap-1">
              {[0, 1, 2].map((i) => {
                const path = list.posterPaths[i]
                const url = path ? posterUrl(path, 'w185') : null
                return url ? (
                  <img key={i} src={url} alt="" className="h-14 flex-1 rounded-md object-cover" />
                ) : (
                  <span key={i} className="h-14 flex-1 rounded-md bg-overlay" />
                )
              })}
            </div>
            <p className="text-sm font-medium text-snow">{list.name}</p>
            <p className="mt-0.5 text-xs text-ash">
              {list.itemCount} {t.movies.movies} · {list.watchedCount} {t.movies.seen}
            </p>
          </Link>
        ))}
      </div>

      {lists?.length === 0 && !creating && (
        <p className="pt-12 text-center text-sm text-ash">{t.movies.emptyList}</p>
      )}

      {paywall && (
        <Paywall
          title={t.premium.paywall.listsTitle}
          body={t.premium.paywall.listsBody}
          onClose={() => setPaywall(false)}
        />
      )}
    </div>
  )
}
