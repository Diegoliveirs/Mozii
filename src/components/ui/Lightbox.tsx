import { useEffect, useState } from 'react'
import { usePhotoUrl } from '../../hooks/useFeed'
import { t } from '../../lib/i18n'

/** Visualização ampliada de foto(s) de uma memória. Fecha com X, clique fora ou Esc. */
export function Lightbox({
  paths,
  index,
  onClose,
}: {
  paths: string[]
  index: number
  onClose: () => void
}) {
  const [current, setCurrent] = useState(index)
  const path = paths[current]
  const { data: url } = usePhotoUrl(path ?? null)
  const hasMany = paths.length > 1

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && hasMany) setCurrent((c) => (c - 1 + paths.length) % paths.length)
      else if (e.key === 'ArrowRight' && hasMany) setCurrent((c) => (c + 1) % paths.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasMany, paths.length, onClose])

  function go(delta: number, e: React.MouseEvent) {
    e.stopPropagation()
    setCurrent((c) => (c + delta + paths.length) % paths.length)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label={t.lightbox.close}
        className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-transform active:scale-90"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {url ? (
        <img
          src={url}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
        />
      ) : (
        <div className="h-40 w-40 animate-pulse rounded-lg bg-white/10" />
      )}

      {hasMany && (
        <>
          <button
            onClick={(e) => go(-1, e)}
            aria-label={t.lightbox.prev}
            className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-transform active:scale-90"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={(e) => go(1, e)}
            aria-label={t.lightbox.next}
            className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-transform active:scale-90"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <span className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] rounded-full bg-white/10 px-3 py-1 text-xs text-white">
            {t.lightbox.counter(current + 1, paths.length)}
          </span>
        </>
      )}
    </div>
  )
}
