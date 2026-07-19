import { useSearchParams } from 'react-router-dom'
import { CinemaSearch } from '../components/cinema/CinemaSearch'
import { CinemaLists } from '../components/cinema/CinemaLists'
import { t } from '../lib/i18n'

type Tab = 'buscar' | 'listas'

export function CinemaPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('aba') === 'listas' ? 'listas' : 'buscar'

  // o segmento vive na URL: deep-link e "voltar" de /filme|/listas:id preservam a aba
  function select(next: Tab) {
    setParams(next === 'buscar' ? {} : { aba: next }, { replace: true })
  }

  return (
    <div className="px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="mb-4 flex rounded-full border border-line bg-card p-1">
        {(['buscar', 'listas'] as const).map((key) => (
          <button
            key={key}
            onClick={() => select(key)}
            aria-pressed={tab === key}
            className={`flex-1 rounded-full py-2 text-sm transition-colors ${
              tab === key ? 'bg-rose/15 font-medium text-rose-soft' : 'text-ash'
            }`}
          >
            {key === 'buscar' ? t.nav.search : t.nav.lists}
          </button>
        ))}
      </div>

      {tab === 'buscar' ? <CinemaSearch /> : <CinemaLists />}
    </div>
  )
}
