import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export function PageHeader({
  title,
  backTo,
  action,
}: {
  title?: string
  backTo?: string
  action?: ReactNode
}) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 bg-night/85 px-4 py-3 backdrop-blur">
      <button
        onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
        aria-label="Voltar"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-snow transition-transform active:scale-90"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6l6 6" />
        </svg>
      </button>
      {title && <h1 className="min-w-0 flex-1 truncate text-base font-medium text-snow">{title}</h1>}
      {!title && <span className="flex-1" />}
      {action}
    </header>
  )
}
