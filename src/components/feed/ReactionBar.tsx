import { useState } from 'react'
import type { Reaction } from '../../domain/types'
import { useToggleReaction } from '../../hooks/useComments'
import { useMyProfile } from '../../hooks/useCouple'
import { ReactionPicker } from './ReactionPicker'
import { t } from '../../lib/i18n'

// Chips dinâmicos: mostra os emojis que EXISTEM nas reações do post (qualquer
// emoji — o banco aceita string livre), mais o botão que abre o picker.
export function ReactionBar({ postId, reactions }: { postId: string; reactions: Reaction[] }) {
  const toggle = useToggleReaction()
  const { data: profile } = useMyProfile()
  const [pickerOpen, setPickerOpen] = useState(false)

  const groups: { emoji: string; count: number; mine: boolean }[] = []
  const byEmoji = new Map<string, number>()
  for (const r of reactions) {
    let i = byEmoji.get(r.emoji)
    if (i === undefined) {
      i = groups.length
      byEmoji.set(r.emoji, i)
      groups.push({ emoji: r.emoji, count: 0, mine: false })
    }
    groups[i].count++
    if (r.authorId === profile?.id) groups[i].mine = true
  }

  function handlePick(emoji: string) {
    setPickerOpen(false)
    toggle.mutate({ postId, emoji })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {groups.map((g) => (
        <button
          key={g.emoji}
          onClick={() => toggle.mutate({ postId, emoji: g.emoji })}
          aria-label={`${t.reactions.react} ${g.emoji}`}
          className={`rounded-full px-2 py-1 text-sm ${g.mine ? 'bg-rose/20' : 'bg-overlay'}`}
        >
          {g.emoji}
          <span className="ml-1 text-xs text-ash">{g.count}</span>
        </button>
      ))}
      <button
        onClick={() => setPickerOpen(true)}
        aria-label={t.reactions.more}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-overlay text-ash"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
          <path d="M12 21a9 9 0 1 1 9-9" />
          <path d="M16 19h6M19 16v6" />
        </svg>
      </button>
      {pickerOpen && <ReactionPicker onPick={handlePick} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}
