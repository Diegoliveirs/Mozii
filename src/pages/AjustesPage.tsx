import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRepositories } from '../data/RepositoriesContext'
import { useCouple, useMyProfile } from '../hooks/useCouple'
import {
  useLeaveCouple,
  useRequestDeletion,
  useUpdateAvatar,
  useUpdateDisplayName,
} from '../hooks/useProfile'
import { useLists } from '../hooks/useLists'
import { useEntitlement } from '../hooks/useEntitlements'
import { ProfileAvatar } from '../components/feed/ProfileAvatar'
import { PremiumBadge } from '../components/premium/PremiumBadge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { PageHeader } from '../components/layout/PageHeader'
import { t } from '../lib/i18n'

export function AjustesPage() {
  const { auth } = useRepositories()
  const navigate = useNavigate()
  const { data: profile } = useMyProfile()
  const { data: coupleData } = useCouple()
  const { data: lists } = useLists()
  const { data: ent } = useEntitlement()
  const updateName = useUpdateDisplayName()
  const updateAvatar = useUpdateAvatar()
  const leaveCouple = useLeaveCouple()
  const requestDeletion = useRequestDeletion()
  const fileInput = useRef<HTMLInputElement>(null)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmDeletion, setConfirmDeletion] = useState(false)

  const members = coupleData?.members ?? []
  const myIndex = members.findIndex((m) => m.id === profile?.id)
  const others = members
    .map((member, index) => ({ member, index }))
    .filter(({ member }) => member.id !== profile?.id)

  const watched = lists?.reduce((sum, l) => sum + l.watchedCount, 0) ?? 0
  const wishlisted = lists?.reduce((sum, l) => sum + l.itemCount, 0) ?? 0

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await updateAvatar.mutateAsync(file)
  }

  async function handleName(e: React.FormEvent) {
    e.preventDefault()
    await updateName.mutateAsync(name.trim())
    setEditingName(false)
  }

  async function handleSignOut() {
    await auth.signOut()
    navigate('/entrar')
  }

  async function handleLeaveCouple() {
    await leaveCouple.mutateAsync()
    setConfirmLeave(false)
    navigate('/parear')
  }

  async function handleDeleteAccount() {
    await requestDeletion.mutateAsync()
    await auth.signOut()
    navigate('/entrar')
  }

  return (
    <div>
      <PageHeader title={t.profile.settings} backTo="/perfil" />
      <div className="px-4 pb-4">
        <div className="mb-4 flex flex-col items-center">
          <button
            onClick={() => fileInput.current?.click()}
            aria-label="Trocar foto de perfil"
            className="relative"
            disabled={updateAvatar.isPending}
          >
            <ProfileAvatar profile={profile ?? undefined} index={Math.max(myIndex, 0)} size="lg" />
            <span className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-rose text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 7h1a2 2 0 0 0 2-2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2M12 14m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />
              </svg>
            </span>
          </button>
          <input ref={fileInput} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />

          {editingName ? (
            <form onSubmit={handleName} className="mt-3 flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-40 rounded-xl border border-line-strong bg-card px-3 py-1.5 text-center text-base text-snow outline-none focus:border-rose"
              />
              <button
                type="submit"
                disabled={!name.trim() || updateName.isPending}
                className="rounded-xl bg-rose px-3 py-1.5 text-sm text-white disabled:opacity-40"
              >
                {t.common.save}
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setName(profile?.displayName ?? '')
                setEditingName(true)
              }}
              className="mt-3 flex items-center gap-1.5 text-base font-medium text-snow"
            >
              {profile?.displayName ?? '…'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8d8499" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16v4M13.5 6.5l4 4" />
              </svg>
            </button>
          )}
        </div>

        <div className="space-y-3">
          {others.length > 0 && (
            <div className="rounded-2xl bg-card p-4">
              <p className="mb-2 text-xs text-ash">
                {others.length === 1 ? t.group.partner : t.group.title}
              </p>
              {others.map(({ member, index }, i) => (
                <div key={member.id} className={`flex items-center gap-3 py-1.5 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <ProfileAvatar profile={member} index={index} size="md" />
                  <p className="text-sm font-medium text-snow">{member.displayName}</p>
                </div>
              ))}
            </div>
          )}
          {others.length === 0 && coupleData && (
            <div className="rounded-2xl bg-card p-4">
              <p className="text-xs text-ash">{t.pairing.yourCode}</p>
              <p className="mt-1 font-mono text-lg tracking-[0.3em] text-snow">
                {coupleData.couple.inviteCode}
              </p>
              <p className="mt-1 text-xs text-ash">{t.pairing.waiting}</p>
            </div>
          )}

          {others.length > 0 && ent?.isPremium && members.length < 8 && coupleData && (
            <div className="rounded-2xl bg-card p-4">
              <p className="text-xs text-ash">{t.group.invite}</p>
              <p className="mt-1 font-mono text-lg tracking-[0.3em] text-snow">
                {coupleData.couple.inviteCode}
              </p>
              <p className="mt-1 text-xs text-ash">{t.group.inviteHint(members.length)}</p>
            </div>
          )}
          {others.length > 0 && ent && !ent.isPremium && (
            <Link
              to="/premium"
              className="flex items-center justify-between rounded-2xl bg-card p-4 transition-transform active:scale-[0.98]"
            >
              <span className="flex-1 text-xs text-ash">{t.group.upsell}</span>
              <span className="ml-2 text-rose-soft">›</span>
            </Link>
          )}

          <PremiumBadge />

          <div className="rounded-2xl bg-card p-4">
            <p className="mb-3 text-xs text-ash">{t.profile.numbers}</p>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-overlay py-3">
                <p className="text-xl font-medium text-snow">{watched}</p>
                <p className="text-[11px] text-ash">{t.profile.watchedTogether}</p>
              </div>
              <div className="rounded-xl bg-overlay py-3">
                <p className="text-xl font-medium text-snow">{wishlisted}</p>
                <p className="text-[11px] text-ash">{t.profile.wishlist}</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full rounded-2xl border border-line-strong p-4 text-sm text-rose-soft"
          >
            {t.auth.signOut}
          </button>

          <div className="rounded-2xl border border-rose/30 p-4">
            <p className="mb-3 text-xs text-ash">Zona de perigo</p>
            {profile?.coupleId && (
              <button
                onClick={() => setConfirmLeave(true)}
                className="mb-2 w-full rounded-xl border border-line-strong py-3 text-sm text-rose-soft transition-transform active:scale-[0.97]"
              >
                {t.danger.leaveCouple}
              </button>
            )}
            <button
              onClick={() => setConfirmDeletion(true)}
              className="w-full rounded-xl bg-rose/15 py-3 text-sm font-medium text-rose-soft transition-transform active:scale-[0.97]"
            >
              {t.danger.deleteAccount}
            </button>
          </div>
        </div>
      </div>

      {confirmLeave && (
        <ConfirmDialog
          message={t.danger.leaveConfirm}
          confirmLabel={t.danger.leave}
          onConfirm={handleLeaveCouple}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
      {confirmDeletion && (
        <ConfirmDialog
          message={t.danger.deleteConfirm}
          confirmLabel={t.danger.deleteAccount}
          onConfirm={handleDeleteAccount}
          onCancel={() => setConfirmDeletion(false)}
        />
      )}
    </div>
  )
}
