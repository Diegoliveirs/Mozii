import type { Post, Profile } from '../../domain/types'
import { posterUrl } from '../../api/tmdb'
import { t } from '../../lib/i18n'
import { CARD, CARD_THEMES, DEFAULT_THEME, cardFooter, type CardTheme } from '../../lib/shareCardLayout'
import { StarRating } from '../movies/StarRating'

// Preview visual do share card. O PNG exportado é desenhado em canvas por
// renderShareCard.ts a partir das MESMAS constantes de shareCardLayout.ts.
export function ShareCard({
  post,
  author,
  avatarUrl,
  authorIndex = 0,
  memberCount = 2,
  isPremium = false,
  theme = DEFAULT_THEME,
}: {
  post: Post
  author: Profile | undefined
  avatarUrl: string | null
  authorIndex?: number
  memberCount?: number
  isPremium?: boolean
  theme?: CardTheme
}) {
  const baseUrl = post.movie ? posterUrl(post.movie.posterPath, 'w500') : null
  const url = baseUrl ? `${baseUrl}?share=1` : null
  const authorName = author?.displayName ?? t.appName
  const snippet = post.body && post.body.length > 140 ? `${post.body.slice(0, 140)}…` : post.body

  return (
    <div
      style={{
        width: CARD.width,
        height: CARD.height,
        background: CARD_THEMES[theme].background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: CARD.padding,
        boxSizing: 'border-box',
        fontFamily: CARD.fontStack,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: CARD.author.gap,
          marginBottom: CARD.author.marginBottom,
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            style={{
              width: CARD.author.avatarSize,
              height: CARD.author.avatarSize,
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <span
            style={{
              width: CARD.author.avatarSize,
              height: CARD.author.avatarSize,
              borderRadius: '50%',
              background:
                CARD.author.fallbackColors[authorIndex % CARD.author.fallbackColors.length],
              color: CARD.author.fallbackText,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: CARD.author.avatarSize * 0.42,
              fontWeight: 500,
            }}
          >
            {authorName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span style={{ fontSize: CARD.author.nameSize, fontWeight: 500, color: CARD.author.nameColor }}>
          {authorName}
        </span>
      </div>
      {url ? (
        <img
          src={url}
          crossOrigin="anonymous"
          alt=""
          style={{
            width: CARD.poster.width,
            height: CARD.poster.height,
            objectFit: 'cover',
            borderRadius: CARD.poster.radius,
          }}
        />
      ) : (
        <div
          style={{
            width: CARD.poster.width,
            height: CARD.poster.height,
            borderRadius: CARD.poster.radius,
            background: CARD.poster.placeholderBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: CARD.poster.placeholderColor,
            fontSize: CARD.poster.placeholderSize,
            padding: 40,
            boxSizing: 'border-box',
          }}
        >
          {post.movie?.title}
        </div>
      )}
      <p
        style={{
          fontSize: CARD.title.size,
          fontWeight: CARD.title.weight,
          color: CARD.title.color,
          margin: `${CARD.title.marginTop}px 0 0`,
        }}
      >
        {post.movie?.title}{' '}
        {post.movie?.releaseYear && (
          <span style={{ fontWeight: 400, color: CARD.title.yearColor }}>
            {post.movie.releaseYear}
          </span>
        )}
      </p>
      {post.rating !== null && (
        <div style={{ fontSize: CARD.stars.size, margin: `${CARD.stars.marginY}px 0` }}>
          {/* literal: Tailwind não gera classes dinâmicas (== CARD.stars.size) */}
          <StarRating value={post.rating} size="text-[64px]" />
        </div>
      )}
      {snippet && (
        <p
          style={{
            fontFamily: CARD.serifStack,
            fontSize: CARD.snippet.size,
            lineHeight: CARD.snippet.lineHeight,
            color: CARD.snippet.color,
            margin: `0 0 ${CARD.snippet.marginBottom}px`,
            maxWidth: CARD.snippet.maxWidth,
          }}
        >
          “{snippet}”
        </p>
      )}
      <p style={{ fontSize: CARD.footer.size, color: CARD.footer.color, margin: 0 }}>
        {cardFooter(t.share.reviewedBy(memberCount), isPremium)}
      </p>
    </div>
  )
}
