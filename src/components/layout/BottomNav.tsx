import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

function Tab({ to, label, children }: { to: string; label: string; children: (active: boolean) => ReactNode }) {
  return (
    <NavLink to={to} aria-label={label} className="flex flex-1 flex-col items-center gap-0.5 py-2">
      {({ isActive }) => (
        <>
          <span
            className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
              isActive ? 'bg-rose/15 text-rose-soft' : 'text-ash'
            }`}
          >
            {children(isActive)}
          </span>
          <span className={`text-[10px] ${isActive ? 'text-rose-soft' : 'text-ash'}`}>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function Icon({ d, filled }: { d: string; filled?: boolean }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-md items-center border-t border-line bg-night/95 pb-[env(safe-area-inset-bottom)] backdrop-blur select-none">
      <Tab to="/" label="Feed">
        {(active) => (
          <Icon
            filled={active}
            d="M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"
          />
        )}
      </Tab>
      <Tab to="/buscar" label="Buscar">
        {() => <Icon d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M21 21l-6-6" />}
      </Tab>
      <NavLink
        to="/novo"
        aria-label="Novo post"
        className="mx-2 -mt-6 flex h-13 w-13 items-center justify-center rounded-full bg-rose text-white shadow-lg shadow-rose/30 transition-transform active:scale-90"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </NavLink>
      <Tab to="/listas" label="Listas">
        {() => <Icon d="M9 6h11M9 12h11M9 18h11M5 6v.01M5 12v.01M5 18v.01" />}
      </Tab>
      <Tab to="/perfil" label="Perfil">
        {(active) => (
          <Icon filled={active} d="M12 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        )}
      </Tab>
    </nav>
  )
}
