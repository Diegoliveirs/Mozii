import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRepositories } from '../data/RepositoriesContext'
import { t } from '../lib/i18n'

export function LoginPage() {
  const { auth } = useRepositories()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await auth.signIn(email, password)
      navigate('/')
    } catch {
      setError('E-mail ou senha incorretos')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <h1 className="font-voice text-4xl text-snow">{t.appName}</h1>
      <p className="mt-1 mb-10 text-sm text-ash">{t.tagline}</p>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <input
          type="email"
          required
          placeholder={t.auth.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-line-strong bg-card px-4 py-3 text-base text-snow placeholder-ash outline-none focus:border-rose"
        />
        <input
          type="password"
          required
          placeholder={t.auth.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-line-strong bg-card px-4 py-3 text-base text-snow placeholder-ash outline-none focus:border-rose"
        />
        {error && <p className="text-sm text-rose-soft">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-rose py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {t.auth.signIn}
        </button>
      </form>
      <Link to="/cadastro" className="mt-6 text-sm text-ash underline-offset-2 hover:underline">
        {t.auth.noAccount}
      </Link>
    </div>
  )
}
