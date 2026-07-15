import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCouple, useCreateCouple, useJoinCouple } from '../hooks/useCouple'
import { t } from '../lib/i18n'

export function PairingPage() {
  const navigate = useNavigate()
  const { data: coupleData } = useCouple()
  const createCouple = useCreateCouple()
  const joinCouple = useJoinCouple()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const inviteCode = coupleData?.couple.inviteCode ?? createCouple.data?.inviteCode

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await joinCouple.mutateAsync(code.trim())
      navigate('/')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg.includes('completo') ? t.pairing.full : t.pairing.invalid)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <h1 className="font-voice text-4xl text-snow">{t.appName}</h1>
      <p className="mt-1 mb-10 text-sm text-ash">{t.tagline}</p>

      <div className="w-full max-w-sm space-y-4">
        {inviteCode ? (
          <div className="rounded-2xl bg-card p-6 text-center">
            <p className="text-sm text-ash">{t.pairing.yourCode}</p>
            <p className="my-4 font-mono text-3xl tracking-[0.4em] text-snow">{inviteCode}</p>
            <p className="text-xs text-ash">{t.pairing.waiting}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 w-full rounded-xl bg-rose py-3 text-sm font-medium text-white"
            >
              Continuar
            </button>
          </div>
        ) : (
          <button
            onClick={() => createCouple.mutate()}
            disabled={createCouple.isPending}
            className="w-full rounded-2xl bg-card p-6 text-left disabled:opacity-60"
          >
            <p className="font-medium text-snow">{t.pairing.createSpace}</p>
            <p className="mt-1 text-xs text-ash">{t.pairing.createHint}</p>
          </button>
        )}

        <form onSubmit={handleJoin} className="rounded-2xl bg-card p-6">
          <p className="mb-3 font-medium text-snow">{t.pairing.haveCode}</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t.pairing.codePlaceholder}
            maxLength={6}
            className="w-full rounded-xl border border-line-strong bg-night px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-snow placeholder-ash outline-none focus:border-rose"
          />
          {error && <p className="mt-2 text-sm text-rose-soft">{error}</p>}
          <button
            type="submit"
            disabled={code.length < 6 || joinCouple.isPending}
            className="mt-3 w-full rounded-xl bg-rose py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {t.pairing.join}
          </button>
        </form>
      </div>
    </div>
  )
}
