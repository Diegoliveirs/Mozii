import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function AppShell() {
  const location = useLocation()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main key={location.pathname} className="page-in flex-1 pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
