import { t } from '../../lib/i18n'

// Fileira rápida no topo (padrão WhatsApp) + grade de emojis comuns.
// Picker próprio e leve — sem lib externa (bundle já está no limite).
const QUICK = ['❤️', '😂', '😮', '😢', '🙏', '👍']

const CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Carinhas',
    emojis: [
      '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘',
      '😜', '🤪', '😎', '🥺', '🥹', '😢', '😭', '😤',
      '😡', '🤬', '😱', '😨', '😴', '🥱', '🤔', '🫠',
      '🙄', '😬', '🤯', '🥴', '🤢', '🤮', '🤧', '🤒',
      '🤗', '🤫', '🤭', '😇', '🤠', '🥳', '😈', '💀',
    ],
  },
  {
    name: 'Gestos',
    emojis: [
      '👍', '👎', '👏', '🙌', '🙏', '🤝', '💪', '🫶',
      '👌', '✌️', '🤞', '🤘', '🤙', '👊', '✊', '🖐️',
      '☝️', '👀', '🧠', '🫀', '🗣️', '💁', '🤷', '🙆',
    ],
  },
  {
    name: 'Amor',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '❤️‍🔥', '💔', '💕', '💞', '💓', '💗', '💖',
    ],
  },
  {
    name: 'Cinema e comida',
    emojis: [
      '🍿', '🎬', '🎥', '📽️', '🎞️', '🎭', '🏆', '⭐',
      '🌟', '✨', '🔥', '💯', '🍕', '🍫', '🍷', '🥤',
    ],
  },
  {
    name: 'Diversos',
    emojis: [
      '🎉', '🎊', '💥', '💤', '💩', '👻', '👽', '🤖',
      '🌈', '☔', '🌙', '☀️', '🎵', '🎶', '💬', '💭',
      '🚀', '⏰', '📅', '🔁', '❓', '❗', '✅', '❌',
    ],
  },
]

export function ReactionPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex justify-between px-1">
          {QUICK.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onPick(emoji)}
              aria-label={`${t.reactions.react} ${emoji}`}
              className="rounded-full p-1.5 text-3xl transition-transform active:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="max-h-72 overflow-y-auto border-t border-line pt-1">
          {CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <p className="mt-2 mb-1 text-xs text-ash">{cat.name}</p>
              <div className="grid grid-cols-8 gap-0.5">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onPick(emoji)}
                    aria-label={`${t.reactions.react} ${emoji}`}
                    className="rounded-lg py-1 text-2xl active:bg-overlay"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
