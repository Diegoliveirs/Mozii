import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ListItem } from '../../domain/types'
import { Poster } from './Poster'

// delays crescentes = o "rolo" desacelera até travar (~1,5s no total)
const ROLL_DELAYS = [70, 70, 80, 95, 115, 140, 170, 210, 260, 320]

export function RandomPickModal({ items, onClose }: { items: ListItem[]; onClose: () => void }) {
  const unwatched = items.filter((i) => !i.watched)
  const pickRandom = useCallback(
    () => unwatched[Math.floor(Math.random() * unwatched.length)] ?? null,
    [unwatched],
  )

  const [phase, setPhase] = useState<'rolling' | 'revealed'>('rolling')
  const [pick, setPick] = useState<ListItem | null>(null)
  const [frameItem, setFrameItem] = useState<ListItem | null>(() => unwatched[0] ?? null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const roll = useCallback(() => {
    if (unwatched.length === 0) {
      setPick(null)
      setPhase('revealed')
      return
    }
    clearTimers()
    const final = pickRandom()!
    setPhase('rolling')
    setPick(null)

    // ciclo sequencial pelos pôsteres (efeito de rolo), a partir de um offset aleatório
    let idx = Math.floor(Math.random() * unwatched.length)
    setFrameItem(unwatched[idx])
    let elapsed = 0
    ROLL_DELAYS.forEach((delay) => {
      elapsed += delay
      timers.current.push(
        setTimeout(() => {
          idx = (idx + 1) % unwatched.length
          setFrameItem(unwatched[idx])
        }, elapsed),
      )
    })
    // trava no sorteado e revela
    timers.current.push(
      setTimeout(() => {
        setFrameItem(final)
        setPick(final)
        setPhase('revealed')
      }, elapsed + ROLL_DELAYS[ROLL_DELAYS.length - 1]),
    )
  }, [unwatched, pickRandom, clearTimers])

  // sorteia ao montar; limpa timers ao desmontar
  useEffect(() => {
    roll()
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rolling = phase === 'rolling'

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-8" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-3xl bg-card p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-sm font-medium text-snow">{rolling ? 'Sorteando…' : 'O que ver hoje 🎬'}</p>
        {unwatched.length === 0 ? (
          <p className="text-sm text-ash">Nenhum filme não visto nesta lista.</p>
        ) : rolling ? (
          <div aria-hidden="true">
            {frameItem && (
              <Poster
                posterPath={frameItem.movie.posterPath}
                title={frameItem.movie.title}
                size="xl"
                className="mx-auto opacity-70 blur-[1px]"
              />
            )}
            <p className="mt-3 text-base font-medium text-transparent select-none">·</p>
          </div>
        ) : (
          pick && (
            <Link key={pick.id} to={`/filme/${pick.movie.tmdbId}`} className="pop-in inline-block">
              <Poster posterPath={pick.movie.posterPath} title={pick.movie.title} size="xl" className="mx-auto" />
              <p className="mt-3 text-base font-medium text-snow">{pick.movie.title}</p>
              {pick.movie.releaseYear && <p className="text-xs text-ash">{pick.movie.releaseYear}</p>}
            </Link>
          )
        )}
        {unwatched.length > 0 && (
          <button
            onClick={roll}
            disabled={rolling}
            className="mt-5 w-full rounded-xl bg-rose py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Sortear de novo
          </button>
        )}
        <button onClick={onClose} className="mt-2 w-full py-2 text-sm text-ash">
          Fechar
        </button>
      </div>
    </div>
  )
}
