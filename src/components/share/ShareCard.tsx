import { forwardRef } from 'react'
import type { Post, Profile } from '../../domain/types'
import { posterUrl } from '../../api/tmdb'
import { t } from '../../lib/i18n'
import { StarRating } from '../movies/StarRating'

export const ShareCard = forwardRef<
  HTMLDivElement,
  { post: Post; members: Profile[]; offscreen?: boolean }
>(function ShareCard({ post, members, offscreen = false }, ref) {
    const url = post.movie ? posterUrl(post.movie.posterPath, 'w500') : null
    const names = members.map((m) => m.displayName).join(' ♥ ')
    const snippet = post.body && post.body.length > 140 ? `${post.body.slice(0, 140)}…` : post.body

    return (
      <div
        ref={ref}
        style={{
          ...(offscreen ? { position: 'fixed' as const, left: -9999, top: 0 } : {}),
          width: 1080,
          height: 1920,
          background: '#0e0b12',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 80,
          boxSizing: 'border-box',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 44, color: '#8d8499', margin: '0 0 60px' }}>
          {t.appName} · {names}
        </p>
        {url ? (
          <img
            src={url}
            crossOrigin="anonymous"
            alt=""
            style={{ width: 480, height: 720, objectFit: 'cover', borderRadius: 32 }}
          />
        ) : (
          <div
            style={{
              width: 480,
              height: 720,
              borderRadius: 32,
              background: '#221d2b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8d8499',
              fontSize: 40,
              padding: 40,
              boxSizing: 'border-box',
            }}
          >
            {post.movie?.title}
          </div>
        )}
        <p style={{ fontSize: 52, fontWeight: 500, color: '#f2edf5', margin: '56px 0 0' }}>
          {post.movie?.title}{' '}
          {post.movie?.releaseYear && (
            <span style={{ fontWeight: 400, color: '#8d8499' }}>{post.movie.releaseYear}</span>
          )}
        </p>
        {post.rating !== null && (
          <div style={{ fontSize: 64, margin: '24px 0' }}>
            <StarRating value={post.rating} size="text-[64px]" />
          </div>
        )}
        {snippet && (
          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 38,
              lineHeight: 1.6,
              color: '#c3bccd',
              margin: '0 0 60px',
              maxWidth: 800,
            }}
          >
            “{snippet}”
          </p>
        )}
        <p style={{ fontSize: 28, color: '#5f5866', margin: 0 }}>
          {t.share.reviewedTogether} · mozii
        </p>
      </div>
    )
  },
)
