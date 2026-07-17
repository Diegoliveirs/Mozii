import { useMemo, useState } from 'react'
import type { Post } from '../domain/types'
import { useFeedInfinite } from '../hooks/useFeed'
import { useCouple } from '../hooks/useCouple'
import { useCommentCounts, useReactions } from '../hooks/useComments'
import { FeedItemCard } from '../components/feed/FeedItemCard'
import { ShareCardModal } from '../components/share/ShareCardModal'
import { t } from '../lib/i18n'

export function FeedPage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeedInfinite()
  const { data: coupleData } = useCouple()
  const [sharePost, setSharePost] = useState<Post | null>(null)

  const posts = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data])
  const postIds = useMemo(() => posts.map((p) => p.id), [posts])
  const { data: reactions } = useReactions(postIds)
  const { data: commentCounts } = useCommentCounts(postIds)

  const members = coupleData?.members ?? []

  return (
    <div className="px-3 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="mb-4 flex items-center justify-between px-1">
        <span className="font-voice text-2xl text-snow">{t.appName}</span>
        {members.length === 2 && (
          <span className="text-xs text-ash">
            {members[0].displayName} <span className="text-rose-soft">♥</span> {members[1].displayName}
          </span>
        )}
      </div>

      {isLoading && <p className="pt-12 text-center text-sm text-ash">{t.common.loading}</p>}
      {!isLoading && posts.length === 0 && (
        <p className="pt-12 text-center text-sm text-ash">{t.feed.empty}</p>
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

      {sharePost && <ShareCardModal post={sharePost} onClose={() => setSharePost(null)} />}
    </div>
  )
}
