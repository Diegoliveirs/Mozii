import { useState } from 'react'
import type { Post } from '../../domain/types'
import { useCouple } from '../../hooks/useCouple'
import { useEntitlement } from '../../hooks/useEntitlements'
import { renderShareCard } from '../../lib/renderShareCard'
import { CARD_THEMES, DEFAULT_THEME, type CardTheme } from '../../lib/shareCardLayout'
import { ShareCard } from './ShareCard'
import { t } from '../../lib/i18n'

export function ShareCardModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const { data: coupleData } = useCouple()
  const { data: ent } = useEntitlement()
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<CardTheme>(DEFAULT_THEME)
  const [error, setError] = useState<string | null>(null)

  const isPremium = ent?.isPremium === true

  async function handleShare() {
    setBusy(true)
    setError(null)
    try {
      const blob = await renderShareCard(post, coupleData?.members ?? [], { isPremium, theme })
      const file = new File([blob], 'mozii-review.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'mozii-review.png'
        a.click()
        URL.revokeObjectURL(url)
      }
      onClose()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(t.common.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-8" onClick={onClose}>
      <div className="w-full max-w-xs rounded-3xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 overflow-hidden rounded-2xl" style={{ aspectRatio: '9 / 16' }}>
          <div
            style={{
              width: 1080,
              height: 1920,
              transform: 'scale(0.25)',
              transformOrigin: 'top left',
            }}
          >
            <ShareCard
              post={post}
              members={coupleData?.members ?? []}
              isPremium={isPremium}
              theme={theme}
            />
          </div>
        </div>

        {/* temas de cor: perk premium */}
        {isPremium && (
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="text-xs text-ash">{t.share.theme}</span>
            {(Object.keys(CARD_THEMES) as CardTheme[]).map((key) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                aria-label={CARD_THEMES[key].label}
                className={`h-6 w-6 rounded-full border-2 ${theme === key ? 'border-rose' : 'border-line-strong'}`}
                style={{ background: CARD_THEMES[key].background }}
              />
            ))}
          </div>
        )}

        {error && <p className="mb-2 text-sm text-rose-soft">{error}</p>}
        <button
          onClick={handleShare}
          disabled={busy}
          className="w-full rounded-xl bg-rose py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? t.common.loading : t.share.share}
        </button>
        <button onClick={onClose} className="mt-2 w-full py-2 text-sm text-ash">
          {t.common.cancel}
        </button>
      </div>
    </div>
  )
}
