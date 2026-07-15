import { Link } from 'react-router-dom'
import type { Post, Profile, Reaction } from '../../domain/types'
import { usePhotoUrl } from '../../hooks/useFeed'
import { timeAgo } from '../../lib/dates'
import { t } from '../../lib/i18n'
import { ProfileAvatar } from './ProfileAvatar'
import { ReactionBar } from './ReactionBar'
import { Poster } from '../movies/Poster'
import { StarRating } from '../movies/StarRating'

interface Props {
  post: Post
  members: Profile[]
  reactions: Reaction[]
  onShare?: (post: Post) => void
}

function AuthorHeader({ post, members, action }: { post: Post; members: Profile[]; action?: string }) {
  const authorIndex = members.findIndex((m) => m.id === post.authorId)
  const author = members[authorIndex]
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      <ProfileAvatar profile={author} index={Math.max(authorIndex, 0)} />
      <div>
        <p className="text-xs font-medium text-snow">
          {author?.displayName ?? '…'} {action && <span className="font-normal text-ash">{action}</span>}
        </p>
        <p className="text-[10px] text-ash">{timeAgo(post.createdAt)}</p>
      </div>
    </div>
  )
}

function PostPhoto({ photoPath }: { photoPath: string }) {
  const { data: url } = usePhotoUrl(photoPath)
  if (!url) return <div className="mb-2 h-44 animate-pulse rounded-xl bg-overlay" />
  return <img src={url} alt="" className="mb-2 max-h-96 w-full rounded-xl object-cover" />
}

export function FeedItemCard({ post, members, reactions, onShare }: Props) {
  if (post.type === 'activity') {
    const authorIndex = members.findIndex((m) => m.id === post.authorId)
    const author = members[authorIndex]
    const meta = post.activityMeta
    return (
      <div className="flex items-center gap-2 px-1 py-1.5 text-xs text-ash">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5dcaa5" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M9 6h11M9 12h11M9 18h11M5 6v.01M5 12v.01M5 18v.01" />
        </svg>
        <span>
          {author?.displayName} {t.feed.addedTo}{' '}
          <Link to={`/filme/${post.movie?.tmdbId}`} className="text-snow">
            {meta?.movieTitle}
          </Link>{' '}
          {t.feed.toList}{' '}
          <Link to={`/listas/${meta?.listId}`} className="text-snow">
            {meta?.listName}
          </Link>
        </span>
      </div>
    )
  }

  return (
    <article className="rounded-2xl bg-card p-3.5">
      <AuthorHeader post={post} members={members} action={post.type === 'review' ? t.feed.reviewed : undefined} />

      {post.type === 'review' && post.movie && (
        <Link to={`/filme/${post.movie.tmdbId}`} className="mb-2 flex gap-3">
          <Poster posterPath={post.movie.posterPath} title={post.movie.title} size="lg" />
          <div className="min-w-0 pt-1">
            <p className="text-sm font-medium text-snow">
              {post.movie.title}{' '}
              {post.movie.releaseYear && (
                <span className="font-normal text-ash">{post.movie.releaseYear}</span>
              )}
            </p>
            {post.rating !== null && (
              <div className="mt-1">
                <StarRating value={post.rating} size="text-base" />
              </div>
            )}
          </div>
        </Link>
      )}

      {post.photoPath && <PostPhoto photoPath={post.photoPath} />}
      {post.body && <p className="text-sm leading-relaxed text-mist">{post.body}</p>}

      <div className="mt-3 flex items-center justify-between">
        <ReactionBar postId={post.id} reactions={reactions} />
        <div className="flex items-center gap-3">
          {post.type === 'review' && onShare && (
            <button onClick={() => onShare(post)} aria-label={t.share.share} className="text-ash">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4" />
              </svg>
            </button>
          )}
          <Link to={`/post/${post.id}`} aria-label="Comentários" className="text-ash">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 9h8M8 13h6M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12z" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  )
}
