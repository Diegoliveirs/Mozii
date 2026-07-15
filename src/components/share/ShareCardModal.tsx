import { useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import type { Post } from '../../domain/types'
import { useCouple } from '../../hooks/useCouple'
import { ShareCard } from './ShareCard'
import { t } from '../../lib/i18n'

export function ShareCardModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const { data: coupleData } = useCouple()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate(): Promise<Blob> {
    const node = cardRef.current
    if (!node) throw new Error('Card não montado')

    await document.fonts.ready
    await Promise.all(
      Array.from(node.querySelectorAll('img')).map((img) => img.decode().catch(() => {})),
    )

    const capture = () => toBlob(node, { pixelRatio: 1, width: 1080, height: 1920, cacheBust: true })
    const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
      Promise.race([
        p,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Tempo esgotado ao gerar imagem')), 15_000),
        ),
      ])

    // WebKit renderiza vazio na primeira captura — a segunda é a boa
    await withTimeout(capture())
    const blob = await withTimeout(capture())

    // card 1080x1920 real com poster nunca é tão pequeno — branco ≈ poucos KB
    if (!blob || blob.size < 25_000) throw new Error('Imagem gerada em branco')
    return blob
  }

  async function handleShare() {
    setBusy(true)
    setError(null)
    try {
      const blob = await generate()
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
            <ShareCard post={post} members={coupleData?.members ?? []} />
          </div>
        </div>

        <ShareCard post={post} members={coupleData?.members ?? []} ref={cardRef} offscreen />

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
