import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Post } from '../domain/types'
import { useCouple, useMyProfile } from '../hooks/useCouple'
import { useReviewStats } from '../hooks/useProfile'
import { useLists } from '../hooks/useLists'
import { useEntitlement } from '../hooks/useEntitlements'
import { useFavorites } from '../hooks/useFavorites'
import { useMemberFeed, useMemberReviews } from '../hooks/useMemberProfile'
import { useCommentCounts, useReactions } from '../hooks/useComments'
import { ProfileAvatar } from '../components/feed/ProfileAvatar'
import { FeedItemCard } from '../components/feed/FeedItemCard'
import { ShareCardModal } from '../components/share/ShareCardModal'
import { FavoritesRow } from '../components/profile/FavoritesRow'
import { RatingsHistogram } from '../components/profile/RatingsHistogram'
import { StarRating } from '../components/movies/StarRating'
import { posterUrl } from '../api/tmdb'
import { t } from '../lib/i18n'

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-card py-2.5 text-center">
      <p className="text-base font-medium text-snow">{value}</p>
      <p className="text-[10px] text-ash">{label}</p>
    </div>
  )
}

export function ProfilePage() {
  const { memberId } = useParams()
  const navigate = useNavigate()
  const { data: myProfile } = useMyProfile()
  const { data: coupleData } = useCouple()
  const { data: stats } = useReviewStats()
  const { data: lists } = useLists()
  const { data: ent } = useEntitlement()

  const members = coupleData?.members ?? []
  const isSelf = !memberId || memberId === myProfile?.id
  const targetId = memberId ?? myProfile?.id
  const member = members.find((m) => m.id === targetId) ?? (isSelf ? myProfile ?? undefined : undefined)
  const memberIndex = Math.max(members.findIndex((m) => m.id === targetId), 0)

  const { data: favorites } = useFavorites(targetId)
  const { data: reviews } = useMemberReviews(targetId)
  const { data: feedData, fetchNextPage, hasNextPage, isFetchingNextPage } = useMemberFeed(targetId)
  const [sharePost, setSharePost] = useState<Post | null>(null)

  const posts = useMemo(() => feedData?.pages.flatMap((p) => p.items) ?? [], [feedData])
  const postIds = useMemo(() => posts.map((p) => p.id), [posts])
  const { data: reactions } = useReactions(postIds)
  const { data: commentCounts } = useCommentCounts(postIds)

  const mine = (stats ?? []).filter((s) => s.authorId === targetId)
  const avg = mine.length ? mine.reduce((s, r) => s + r.rating, 0) / mine.length : 0
  const thisYear = mine.filter(
    (s) => new Date(s.createdAt).getFullYear() === new Date().getFullYear(),
  ).length
  const listsCount = (lists ?? []).filter((l) => l.createdBy === targetId).length

  return (
    <div className="pb-4">
      {/* barra topo: engrenagem (próprio) ou voltar (outro membro) */}
      <div className="flex items-center px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        {isSelf ? (
          <>
            <span className="flex-1" />
            <Link
              to="/ajustes"
              aria-label={t.profile.settings}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-snow transition-transform active:scale-90"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </>
        ) : (
          <button
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-snow transition-transform active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6l6 6" />
            </svg>
          </button>
        )}
      </div>

      {/* cabeçalho */}
      <div className="flex flex-col items-center px-4">
        <ProfileAvatar profile={member} index={memberIndex} size="lg" />
        <p className="mt-3 text-lg font-medium text-snow">{member?.displayName ?? '…'}</p>

        {members.length > 1 && (
          <div className="mt-3 flex gap-2">
            {members.map((m, i) => {
              const active = m.id === targetId
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(m.id === myProfile?.id ? '/perfil' : `/perfil/${m.id}`)}
                  aria-label={m.displayName}
                  className={`rounded-full ${active ? 'ring-2 ring-rose' : 'opacity-60'}`}
                >
                  <ProfileAvatar profile={m} index={i} size="sm" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-5 space-y-5 px-4">
        {/* números */}
        <div className="grid grid-cols-4 gap-2">
          <Stat value={String(mine.length)} label={t.profile.filmsRated} />
          <Stat value={mine.length ? avg.toFixed(1) : '—'} label={t.profile.average} />
          <Stat value={String(thisYear)} label={t.profile.thisYear} />
          <Stat value={String(listsCount)} label={t.profile.lists} />
        </div>

        {/* favoritos */}
        <FavoritesRow favorites={favorites ?? []} editable={isSelf} />

        {/* avaliações recentes */}
        {reviews && reviews.length > 0 && (
          <section>
            <p className="mb-2 text-xs text-ash">{t.profile.recentActivity}</p>
            <div className="grid grid-cols-3 gap-2">
              {reviews.map((r) => {
                const url = r.movie?.posterPath ? posterUrl(r.movie.posterPath, 'w185') : null
                return (
                  <Link key={r.id} to={`/post/${r.id}`} className="block">
                    {url ? (
                      <img src={url} alt={r.movie?.title ?? ''} className="aspect-[2/3] w-full rounded-lg object-cover" />
                    ) : (
                      <div className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-overlay p-1 text-center text-[9px] text-ash">
                        {r.movie?.title}
                      </div>
                    )}
                    {r.rating !== null && (
                      <span className="mt-1 flex justify-center">
                        <StarRating value={r.rating} size="text-[11px]" />
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* histograma de notas */}
        <RatingsHistogram ratings={mine.map((s) => s.rating)} isPremium={!!ent?.isPremium} />

        {/* Minhas Pegadas — timeline de toda a atividade do membro (reviews, posts,
            memórias, atividades de lista). Ordenada por created_at desc no feed pessoal.
            A estrutura (posts.type) já permite filtrar por tipo no futuro. */}
        <section>
          <p className="mb-2 text-xs text-ash">
            {isSelf ? t.profile.footprints : t.profile.footprintsMember(member?.displayName ?? '')}
          </p>
          {posts.length === 0 && (
            <p className="py-6 text-center text-sm text-ash">{t.profile.emptyActivity}</p>
          )}
          <div className="space-y-3">
            {posts.map((post) => (
              <FeedItemCard
                key={post.id}
                post={post}
                members={members}
                reactions={reactions?.[post.id] ?? []}
                onShare={setSharePost}
                commentCount={commentCounts?.[post.id] ?? 0}
              />
            ))}
          </div>
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-4 w-full rounded-xl border border-line-strong py-3 text-sm text-ash disabled:opacity-60"
            >
              {isFetchingNextPage ? t.common.loading : 'Carregar mais'}
            </button>
          )}
        </section>
      </div>

      {sharePost && <ShareCardModal post={sharePost} onClose={() => setSharePost(null)} />}
    </div>
  )
}
