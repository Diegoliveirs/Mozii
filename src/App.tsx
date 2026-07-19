import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useMyProfile } from './hooks/useCouple'
import { useRepositories } from './data/RepositoriesContext'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { PairingPage } from './pages/PairingPage'
import { SettingsPage } from './pages/SettingsPage'
import { FeedPage } from './pages/FeedPage'
import { NewPostPage } from './pages/NewPostPage'
import { PostDetailPage } from './pages/PostDetailPage'
import { CinemaPage } from './pages/CinemaPage'
import { MomentsPage } from './pages/MomentsPage'
import { MoviePage } from './pages/MoviePage'
import { ListDetailPage } from './pages/ListDetailPage'
import { UpgradePage } from './pages/UpgradePage'
import { t } from './lib/i18n'

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-ash">
      {t.common.loading}
    </div>
  )
}

function RequireAuth() {
  const { user, loading } = useAuth()
  const { couple } = useRepositories()

  // qualquer entrada no app (login ou sessão salva) cancela exclusão pendente
  useEffect(() => {
    if (user) couple.cancelAccountDeletion().catch(() => {})
  }, [user, couple])

  if (loading) return <Loading />
  if (!user) return <Navigate to="/entrar" replace />
  return <Outlet />
}

function RequireCouple() {
  const { data: profile, isLoading } = useMyProfile()
  if (isLoading) return <Loading />
  if (!profile?.coupleId) return <Navigate to="/parear" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage />} />
      <Route path="/cadastro" element={<SignupPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/parear" element={<PairingPage />} />
        <Route element={<RequireCouple />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/momentos" element={<MomentsPage />} />
            <Route path="/novo" element={<NewPostPage />} />
            <Route path="/post/:postId" element={<PostDetailPage />} />
            <Route path="/cinema" element={<CinemaPage />} />
            <Route path="/filme/:tmdbId" element={<MoviePage />} />
            <Route path="/listas/:listId" element={<ListDetailPage />} />
            {/* rotas antigas viram atalho para o hub Cinema (bookmarks/PWA) */}
            <Route path="/buscar" element={<Navigate to="/cinema" replace />} />
            <Route path="/listas" element={<Navigate to="/cinema?aba=listas" replace />} />
            <Route path="/perfil" element={<SettingsPage />} />
            <Route path="/premium" element={<UpgradePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
