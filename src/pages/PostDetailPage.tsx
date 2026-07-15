import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePost, useDeletePost } from '../hooks/useFeed'
import { useComments, useAddComment, useReactions } from '../hooks/useComments'
import { useCouple, useMyProfile } from '../hooks/useCouple'
import { FeedItemCard } from '../components/feed/FeedItemCard'
import { ProfileAvatar } from '../components/feed/ProfileAvatar'
import { PageHeader } from '../components/layout/PageHeader'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { timeAgo } from '../lib/dates'
import { t } from '../lib/i18n'

export function PostDetailPage() {
  const { postId = '' } = useParams()
  const navigate = useNavigate()
  const { data: post, isLoading } = usePost(postId)
  const { data: comments } = useComments(postId)
  const { data: reactions } = useReactions(postId ? [postId] : [])
  const { data: coupleData } = useCouple()
  const { data: profile } = useMyProfile()
  const addComment = useAddComment(postId)
  const deletePost = useDeletePost()
  const [body, setBody] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const members = coupleData?.members ?? []

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    await addComment.mutateAsync(body.trim())
    setBody('')
  }

  async function handleDelete() {
    await deletePost.mutateAsync(postId)
    navigate('/')
  }

  if (isLoading || !post) {
    return <p className="pt-24 text-center text-sm text-ash">{t.common.loading}</p>
  }

  return (
    <div>
      <PageHeader
        title="Publicação"
        action={
          post.authorId === profile?.id ? (
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label={t.common.delete}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-rose-soft transition-transform active:scale-90"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
              </svg>
            </button>
          ) : undefined
        }
      />
      <div className="px-3">
      <FeedItemCard post={post} members={members} reactions={reactions?.[post.id] ?? []} />

      <div className="mt-4 space-y-3 px-1">
        {comments?.map((comment) => {
          const authorIndex = members.findIndex((m) => m.id === comment.authorId)
          const author = members[authorIndex]
          return (
            <div key={comment.id} className="flex gap-2.5">
              <ProfileAvatar profile={author} index={Math.max(authorIndex, 0)} />
              <div className="min-w-0 flex-1 rounded-xl bg-card px-3 py-2">
                <p className="text-xs font-medium text-snow">
                  {author?.displayName}{' '}
                  <span className="font-normal text-ash">{timeAgo(comment.createdAt)}</span>
                </p>
                <p className="mt-0.5 text-sm text-mist">{comment.body}</p>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleComment} className="mt-4 flex gap-2 px-1 pb-4">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Comentar…"
          className="flex-1 rounded-xl border border-line-strong bg-card px-4 py-2.5 text-base text-snow placeholder-ash outline-none focus:border-rose"
        />
        <button
          type="submit"
          disabled={!body.trim() || addComment.isPending}
          className="rounded-xl bg-rose px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          message="Excluir esta publicação?"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
