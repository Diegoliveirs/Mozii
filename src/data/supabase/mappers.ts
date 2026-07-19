import type {
  ActivityMeta,
  Comment,
  Couple,
  ListItem,
  Moment,
  MovieList,
  MovieRef,
  Post,
  Profile,
  Reaction,
} from '../../domain/types'

export function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    coupleId: (row.couple_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

export function mapCouple(row: Record<string, unknown>): Couple {
  return {
    id: row.id as string,
    inviteCode: row.invite_code as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  }
}

export function mapMovie(row: Record<string, unknown>): MovieRef {
  return {
    tmdbId: row.tmdb_id as number,
    title: row.title as string,
    posterPath: (row.poster_path as string | null) ?? null,
    releaseYear: (row.release_year as number | null) ?? null,
    overview: (row.overview as string | null) ?? null,
  }
}

interface ListRow {
  id: string
  couple_id: string
  name: string
  created_by: string
  created_at: string
  list_items?: { watched: boolean; movies: { poster_path: string | null } | null }[]
}

export function mapList(row: ListRow): MovieList {
  const items = row.list_items ?? []
  return {
    id: row.id,
    coupleId: row.couple_id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    itemCount: items.length,
    watchedCount: items.filter((i) => i.watched).length,
    posterPaths: items.slice(0, 3).map((i) => i.movies?.poster_path ?? null),
  }
}

interface ListItemRow {
  id: string
  list_id: string
  added_by: string
  watched: boolean
  created_at: string
  movies: Record<string, unknown>
}

export function mapListItem(row: ListItemRow): ListItem {
  return {
    id: row.id,
    listId: row.list_id,
    movie: mapMovie(row.movies),
    addedBy: row.added_by,
    watched: row.watched,
    createdAt: row.created_at,
  }
}

interface PostRow {
  id: string
  couple_id: string
  author_id: string
  type: 'post' | 'review' | 'activity'
  body: string | null
  photo_path: string | null
  rating: number | string | null
  activity_meta: Record<string, unknown> | null
  created_at: string
  movies: Record<string, unknown> | null
}

export function mapPost(row: PostRow): Post {
  const meta = row.activity_meta
  return {
    id: row.id,
    coupleId: row.couple_id,
    authorId: row.author_id,
    type: row.type,
    body: row.body,
    photoPath: row.photo_path,
    movie: row.movies ? mapMovie(row.movies) : null,
    rating: row.rating === null ? null : Number(row.rating),
    activityMeta: meta
      ? ({
          kind: meta.kind as 'list_add',
          listId: meta.list_id as string,
          listName: meta.list_name as string,
          movieTitle: meta.movie_title as string,
        } satisfies ActivityMeta)
      : null,
    createdAt: row.created_at,
  }
}

export function mapMoment(row: Record<string, unknown>): Moment {
  return {
    id: row.id as string,
    coupleId: row.couple_id as string,
    authorId: row.author_id as string,
    caption: (row.caption as string | null) ?? null,
    happenedOn: row.happened_on as string,
    photoPaths: (row.photo_paths as string[] | null) ?? [],
    createdAt: row.created_at as string,
  }
}

export function mapComment(row: Record<string, unknown>): Comment {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    authorId: row.author_id as string,
    body: row.body as string,
    createdAt: row.created_at as string,
  }
}

export function mapReaction(row: Record<string, unknown>): Reaction {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    authorId: row.author_id as string,
    emoji: row.emoji as string,
    createdAt: row.created_at as string,
  }
}
