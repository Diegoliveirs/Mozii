import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAddComment, useComments } from '../../hooks/useComments'
import { useCouple } from '../../hooks/useCouple'
import { ProfileAvatar } from './ProfileAvatar'
import { timeAgo } from '../../lib/dates'
import { t } from '../../lib/i18n'

// Lista + input de comentários de um post. Usado inline no card do feed
// (expandido pelo ícone) e na página da publicação.
export function CommentSection({
  postId,
  showOpenLink = false,
}: {
  postId: string
  showOpenLink?: boolean
}) {
  const { data: comments } = useComments(postId)
  const { data: coupleData } = useCouple()
  const addComment = useAddComment(postId)
  const [body, setBody] = useState('')
  const members = coupleData?.members ?? []

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setBody('')
    await addComment.mutateAsync(text)
  }

  return (
    <div>
      {comments && comments.length > 0 && (
        <div className="mt-3 space-y-3">
          {comments.map((comment) => {
            const authorIndex = members.findIndex((m) => m.id === comment.authorId)
            const author = members[authorIndex]
            return (
              <div key={comment.id} className="flex gap-2.5">
                <ProfileAvatar profile={author} index={Math.max(authorIndex, 0)} />
                <div className="min-w-0 flex-1 rounded-xl bg-overlay px-3 py-2">
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
      )}

      <form onSubmit={handleComment} className="mt-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t.comments.placeholder}
          className="min-w-0 flex-1 rounded-xl border border-line-strong bg-card px-4 py-2.5 text-base text-snow placeholder-ash outline-none focus:border-rose"
        />
        <button
          type="submit"
          disabled={!body.trim() || addComment.isPending}
          className="rounded-xl bg-rose px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {t.comments.send}
        </button>
      </form>

      {showOpenLink && (
        <Link to={`/post/${postId}`} className="mt-2 inline-block text-xs text-ash underline-offset-2 hover:underline">
          {t.comments.open}
        </Link>
      )}
    </div>
  )
}
