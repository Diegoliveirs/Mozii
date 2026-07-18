import { useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n'

/**
 * Bottom-sheet mostrado quando uma ação premium é bloqueada. O banco já
 * recusa a ação (RLS); isto só orienta o usuário para os planos.
 */
export function Paywall({
  title,
  body,
  onClose,
}: {
  title: string
  body: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label={t.premium.paywall.later} className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="sheet-in relative mx-auto w-full max-w-md rounded-t-3xl bg-card p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
        <p className="text-center text-lg font-medium text-snow">{title}</p>
        <p className="mt-2 text-center text-sm text-ash">{body}</p>
        <button
          onClick={() => navigate('/premium')}
          className="mt-5 w-full rounded-xl bg-rose py-3 text-sm font-medium text-white transition-transform active:scale-[0.97]"
        >
          {t.premium.paywall.seePlans}
        </button>
        <button onClick={onClose} className="mt-2 w-full py-3 text-sm text-ash">
          {t.premium.paywall.later}
        </button>
      </div>
    </div>
  )
}
