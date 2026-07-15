import { t } from '../../lib/i18n'

export function ConfirmDialog({
  message,
  confirmLabel = t.common.delete,
  onConfirm,
  onCancel,
}: {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-10" onClick={onCancel}>
      <div
        className="w-full max-w-xs rounded-3xl bg-card p-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm leading-relaxed text-snow">{message}</p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line-strong py-2.5 text-sm text-ash transition-transform active:scale-[0.97]"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-rose py-2.5 text-sm font-medium text-white transition-transform active:scale-[0.97]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
