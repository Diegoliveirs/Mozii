import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Post } from '../domain/types'
import { useTmdbMovie } from '../hooks/useTmdbSearch'
import { useCreateReview, useDeletePost, useMovieReviews, useUpdateReview } from '../hooks/useFeed'
import { useCouple, useMyProfile } from '../hooks/useCouple'
import { useListsContaining } from '../hooks/useLists'
import { Poster } from '../components/movies/Poster'
import { StarRating } from '../components/movies/StarRating'
import { AddToListSheet } from '../components/movies/AddToListSheet'
import { ProfileAvatar } from '../components/feed/ProfileAvatar'
import { PageHeader } from '../components/layout/PageHeader'
import { backdropUrl } from '../api/tmdb'
import { timeAgo } from '../lib/dates'
import { t } from '../lib/i18n'

function ReviewsSection({
  tmdbId,
  onEdit,
}: {
  tmdbId: number
  onEdit: (review: Post) => void
}) {
  const { data: reviews } = useMovieReviews(tmdbId)
  const { data: coupleData } = useCouple()
  const { data: profile } = useMyProfile()
  const deletePost = useDeletePost()
  const members = coupleData?.members ?? []

  if (!reviews || reviews.length === 0) return null

  const distinctAuthors = new Set(reviews.map((r) => r.authorId))
  const latestByAuthor = [...distinctAuthors].map(
    (id) => reviews.find((r) => r.authorId === id)!,
  )
  const coupleAvg =
    latestByAuthor.length === 2
      ? latestByAuthor.reduce((s, r) => s + (r.rating ?? 0), 0) / 2
      : null

  async function handleDelete(review: Post) {
    if (!confirm('Excluir sua avaliação?')) return
    await deletePost.mutateAsync(review.id)
  }

  return (
    <div className="mx-4 mt-5 rounded-2xl bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-snow">Nossas avaliações</p>
        {coupleAvg !== null && (
          <span className="rounded-full bg-overlay px-2.5 py-1 text-xs text-star">
            ★ {coupleAvg.toFixed(1)} <span className="text-ash">do casal</span>
          </span>
        )}
      </div>
      <div className="space-y-4">
        {reviews.map((review) => {
          const authorIndex = members.findIndex((m) => m.id === review.authorId)
          const author = members[authorIndex]
          const isMine = review.authorId === profile?.id
          return (
            <div key={review.id} className="flex gap-2.5">
              <ProfileAvatar profile={author} index={Math.max(authorIndex, 0)} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-snow">
                    {author?.displayName}{' '}
                    <span className="font-normal text-ash">{timeAgo(review.createdAt)}</span>
                  </p>
                  {isMine && (
                    <span className="flex gap-2 text-[11px]">
                      <button onClick={() => onEdit(review)} className="text-ash underline-offset-2 hover:underline">
                        editar
                      </button>
                      <button onClick={() => handleDelete(review)} className="text-rose-soft underline-offset-2 hover:underline">
                        excluir
                      </button>
                    </span>
                  )}
                </div>
                {review.rating !== null && (
                  <div className="mt-0.5">
                    <StarRating value={review.rating} size="text-sm" />
                  </div>
                )}
                {review.body && <p className="mt-1 text-sm leading-relaxed text-mist">{review.body}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MoviePage() {
  const { tmdbId } = useParams()
  const navigate = useNavigate()
  const id = Number(tmdbId)
  const { data: movie, isLoading } = useTmdbMovie(id)
  const { data: containingLists } = useListsContaining(id)
  const createReview = useCreateReview()
  const updateReview = useUpdateReview()
  const [showSheet, setShowSheet] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')

  if (isLoading || !movie) {
    return <p className="pt-24 text-center text-sm text-ash">{t.common.loading}</p>
  }

  function startEdit(review: Post) {
    setEditingId(review.id)
    setRating(review.rating ?? 0)
    setBody(review.body ?? '')
    setShowReview(true)
  }

  async function handleReview(e: React.FormEvent) {
    e.preventDefault()
    if (!movie || rating === 0) return
    if (editingId) {
      await updateReview.mutateAsync({ postId: editingId, rating, body: body.trim() })
      setEditingId(null)
      setShowReview(false)
      setRating(0)
      setBody('')
    } else {
      await createReview.mutateAsync({ movie, rating, body: body.trim() })
      navigate('/')
    }
  }

  const backdrop = backdropUrl(movie.backdropPath)

  return (
    <div className="relative pb-6">
      {backdrop && (
        <div className="absolute inset-x-0 top-0 -z-10 mx-auto h-52 max-w-md overflow-hidden">
          <img src={backdrop} alt="" className="h-full w-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-night/40 to-night" />
        </div>
      )}
      <PageHeader />
      <div className="flex gap-4 px-4 pt-14">
        <Poster posterPath={movie.posterPath} title={movie.title} size="xl" className="shadow-xl shadow-black/50" />
        <div className="min-w-0 self-end pb-1">
          <h1 className="text-lg font-medium text-snow">{movie.title}</h1>
          <p className="mt-1 text-xs text-ash">
            {[movie.releaseYear, movie.genres[0], movie.runtime ? `${Math.floor(movie.runtime / 60)}h${movie.runtime % 60}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {containingLists && containingLists.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {containingLists.map((list) => (
                <Link
                  key={list.listId}
                  to={`/listas/${list.listId}`}
                  className="rounded-full bg-overlay px-2.5 py-1 text-[11px] text-mist"
                >
                  {list.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {movie.overview && (
        <p className="px-4 pt-4 text-sm leading-relaxed text-mist">{movie.overview}</p>
      )}

      <div className="flex gap-2 px-4 pt-5">
        <button
          onClick={() => setShowSheet(true)}
          className="flex-1 rounded-xl bg-rose py-3 text-sm font-medium text-white transition-transform active:scale-[0.97]"
        >
          + {t.movies.addToList}
        </button>
        <button
          onClick={() => {
            setEditingId(null)
            setShowReview((v) => !v)
          }}
          className="flex-1 rounded-xl border border-line-strong bg-card py-3 text-sm font-medium text-snow transition-transform active:scale-[0.97]"
        >
          ★ {t.movies.rate}
        </button>
      </div>

      {showReview && (
        <form onSubmit={handleReview} className="mx-4 mt-4 rounded-2xl bg-card p-4 text-center">
          <p className="mb-2 text-xs text-ash">
            {editingId ? 'Editar avaliação' : t.movies.yourRating}
          </p>
          <StarRating value={rating} onChange={setRating} size="text-3xl" />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="O que vocês acharam?"
            rows={3}
            className="mt-4 w-full rounded-xl border border-line-strong bg-night px-4 py-3 text-sm text-snow placeholder-ash outline-none focus:border-rose"
          />
          <button
            type="submit"
            disabled={rating === 0 || createReview.isPending || updateReview.isPending}
            className="mt-3 w-full rounded-xl bg-rose py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {editingId ? t.common.save : t.feed.publish}
          </button>
        </form>
      )}

      <ReviewsSection tmdbId={id} onEdit={startEdit} />

      {showSheet && <AddToListSheet movie={movie} onClose={() => setShowSheet(false)} />}
    </div>
  )
}
