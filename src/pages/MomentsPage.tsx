import { Fragment, useMemo, useRef, useState } from 'react'
import { parseISO } from 'date-fns'
import type { Moment, Profile } from '../domain/types'
import { useCreateMoment, useMoments } from '../hooks/useMoments'
import { useCouple } from '../hooks/useCouple'
import { useEntitlement } from '../hooks/useEntitlements'
import { usePhotoUrl } from '../hooks/useFeed'
import { ProfileAvatar } from '../components/feed/ProfileAvatar'
import { Paywall } from '../components/premium/Paywall'
import { coupleAnniversary, formatDayLabel, todayInputValue } from '../lib/dates'
import { t } from '../lib/i18n'

const FREE_MOMENTS_PER_MONTH = 5

function MomentPhoto({ path, className }: { path: string; className: string }) {
  const { data: url } = usePhotoUrl(path)
  if (!url) return <div className={`animate-pulse rounded-xl bg-overlay ${className}`} />
  return <img src={url} alt="" className={`w-full rounded-xl object-cover ${className}`} />
}

function MomentCard({ moment, members }: { moment: Moment; members: Profile[] }) {
  const idx = members.findIndex((m) => m.id === moment.authorId)
  const author = members[idx]
  const photos = moment.photoPaths

  return (
    <div className="rounded-2xl bg-card p-3">
      {photos.length === 1 && <MomentPhoto path={photos[0]} className="max-h-96" />}
      {photos.length > 1 && (
        <div className="grid grid-cols-2 gap-1.5">
          {photos.map((p) => (
            <MomentPhoto key={p} path={p} className="h-36" />
          ))}
        </div>
      )}
      <div className={`flex items-center gap-2 ${photos.length ? 'mt-2.5' : ''}`}>
        <ProfileAvatar profile={author} index={Math.max(idx, 0)} size="sm" />
        {moment.caption && <p className="text-sm leading-snug text-mist">{moment.caption}</p>}
      </div>
    </div>
  )
}

interface Entry {
  key: string
  dayKey: string
  sort: number
  tie: number
  header: string | null
  node: React.ReactNode
}

export function MomentsPage() {
  const { data: moments, isLoading } = useMoments()
  const { data: coupleData } = useCouple()
  const { data: ent } = useEntitlement()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [paywall, setPaywall] = useState(false)

  const members = useMemo(() => coupleData?.members ?? [], [coupleData])

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthCount = (moments ?? []).filter((m) => new Date(m.createdAt) >= monthStart).length
  const atFreeLimit = !ent?.isPremium && monthCount >= FREE_MOMENTS_PER_MONTH

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = (moments ?? []).map((m) => ({
      key: m.id,
      dayKey: m.happenedOn,
      sort: parseISO(m.happenedOn).getTime(),
      tie: new Date(m.createdAt).getTime(),
      header: null,
      node: <MomentCard moment={m} members={members} />,
    }))

    const anniv = coupleData?.couple ? coupleAnniversary(coupleData.couple.createdAt) : null
    if (anniv) {
      list.push({
        key: `anniv-${anniv.years}`,
        dayKey: anniv.dayKey,
        sort: parseISO(anniv.dayKey).getTime(),
        tie: 0, // fica ao fim do seu dia
        header: null,
        node: (
          <div className="flex items-center gap-2 px-1 py-1">
            <span className="h-2 w-2 shrink-0 rounded-full bg-rose" />
            <span className="font-voice text-sm text-rose-soft italic">
              {t.moments.yearsTogether(anniv.years)}
            </span>
          </div>
        ),
      })
    }

    list.sort((a, b) => (b.sort !== a.sort ? b.sort - a.sort : b.tie - a.tie))
    let prev: string | null = null
    for (const e of list) {
      e.header = e.dayKey !== prev ? formatDayLabel(e.dayKey) : null
      prev = e.dayKey
    }
    return list
  }, [moments, members, coupleData])

  function handleNew() {
    if (atFreeLimit) setPaywall(true)
    else setSheetOpen(true)
  }

  return (
    <div className="px-4 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-medium text-snow">{t.moments.title}</h1>
        <button
          onClick={handleNew}
          className="flex items-center gap-1 rounded-full bg-rose/15 px-3 py-2 text-xs font-medium text-rose-soft transition-transform active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t.moments.newMoment}
        </button>
      </div>

      {isLoading && <p className="pt-12 text-center text-sm text-ash">{t.common.loading}</p>}
      {!isLoading && entries.length === 0 && (
        <p className="pt-12 text-center text-sm text-ash">{t.moments.empty}</p>
      )}

      <div className="space-y-2.5">
        {entries.map((e) => (
          <Fragment key={e.key}>
            {e.header && <p className="px-1 pt-2 text-xs font-medium text-ash">{e.header}</p>}
            {e.node}
          </Fragment>
        ))}
      </div>

      {sheetOpen && (
        <NewMomentSheet onClose={() => setSheetOpen(false)} onLimit={() => setPaywall(true)} />
      )}
      {paywall && (
        <Paywall
          title={t.premium.paywall.momentsTitle}
          body={t.premium.paywall.momentsBody}
          onClose={() => setPaywall(false)}
        />
      )}
    </div>
  )
}

function NewMomentSheet({ onClose, onLimit }: { onClose: () => void; onLimit: () => void }) {
  const create = useCreateMoment()
  const [caption, setCaption] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [date, setDate] = useState(todayInputValue())
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setPhotos((p) => [...p, ...files])
    setPreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))])
    if (fileInput.current) fileInput.current.value = ''
  }

  function removePhoto(i: number) {
    URL.revokeObjectURL(previews[i])
    setPhotos((p) => p.filter((_, j) => j !== i))
    setPreviews((p) => p.filter((_, j) => j !== i))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await create.mutateAsync({ caption: caption.trim() || null, happenedOn: date, photos })
      onClose()
    } catch {
      // o banco recusa o 6º momento free do mês (RLS) — mostra paywall, não erro cru
      onClose()
      onLimit()
    }
  }

  const canSave = (caption.trim().length > 0 || photos.length > 0) && !create.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label={t.common.cancel} className="absolute inset-0 bg-black/60" onClick={onClose} />
      <form
        onSubmit={submit}
        className="sheet-in relative mx-auto w-full max-w-md rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
        <p className="mb-4 text-center text-base font-medium text-snow">{t.moments.newMoment}</p>

        <div className="flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative h-20 w-20 shrink-0">
              <img src={src} alt="" className="h-20 w-20 rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label="Remover foto"
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
          <label
            htmlFor="moment-photos"
            className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-[11px] text-ash"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t.moments.addPhoto}
          </label>
          <input
            ref={fileInput}
            id="moment-photos"
            type="file"
            accept="image/*"
            multiple
            onChange={addPhotos}
            className="hidden"
          />
        </div>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t.moments.caption}
          rows={3}
          className="mt-3 w-full rounded-2xl border border-line-strong bg-night px-4 py-3 text-base text-snow placeholder-ash outline-none focus:border-rose"
        />

        <label className="mt-3 flex items-center gap-3 rounded-2xl border border-line-strong bg-night px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ed93b1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zM16 3v4M8 3v4M4 11h16" />
          </svg>
          <span className="flex-1 text-xs text-ash">{t.moments.date}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayInputValue()}
            className="bg-transparent text-sm text-snow outline-none"
          />
        </label>

        {error && <p className="mt-2 text-sm text-rose-soft">{error}</p>}

        <button
          type="submit"
          disabled={!canSave}
          className="mt-4 w-full rounded-xl bg-rose py-3 text-sm font-medium text-white transition-transform active:scale-[0.97] disabled:opacity-40"
        >
          {create.isPending ? t.common.loading : t.moments.save}
        </button>
      </form>
    </div>
  )
}
