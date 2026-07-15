import type { Reaction } from '../../domain/types'
import { useToggleReaction } from '../../hooks/useComments'
import { useMyProfile } from '../../hooks/useCouple'

export const EMOJIS = ['❤️', '😂', '😮', '🥹', '🍿']

export function ReactionBar({ postId, reactions }: { postId: string; reactions: Reaction[] }) {
  const toggle = useToggleReaction()
  const { data: profile } = useMyProfile()

  return (
    <div className="flex gap-1.5">
      {EMOJIS.map((emoji) => {
        const these = reactions.filter((r) => r.emoji === emoji)
        const mine = these.some((r) => r.authorId === profile?.id)
        return (
          <button
            key={emoji}
            onClick={() => toggle.mutate({ postId, emoji })}
            aria-label={`Reagir ${emoji}`}
            className={`rounded-full px-2 py-1 text-sm ${
              mine ? 'bg-rose/20' : these.length > 0 ? 'bg-overlay' : 'opacity-45'
            }`}
          >
            {emoji}
            {these.length > 0 && <span className="ml-1 text-xs text-ash">{these.length}</span>}
          </button>
        )
      })}
    </div>
  )
}
