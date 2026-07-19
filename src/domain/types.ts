export type Unsubscribe = () => void

export interface AuthUser {
  id: string
  email: string
}

export interface Profile {
  id: string
  displayName: string
  avatarUrl: string | null
  coupleId: string | null
  createdAt: string
}

export interface Couple {
  id: string
  inviteCode: string
  createdBy: string
  createdAt: string
}

export interface MovieRef {
  tmdbId: number
  title: string
  posterPath: string | null
  releaseYear: number | null
  overview: string | null
}

export interface MovieList {
  id: string
  coupleId: string
  name: string
  createdBy: string
  createdAt: string
  itemCount: number
  watchedCount: number
  posterPaths: (string | null)[]
}

export interface ListItem {
  id: string
  listId: string
  movie: MovieRef
  addedBy: string
  watched: boolean
  createdAt: string
}

export type PostType = 'post' | 'review' | 'activity'

export interface ActivityMeta {
  kind: 'list_add'
  listId: string
  listName: string
  movieTitle: string
}

export interface Post {
  id: string
  coupleId: string
  authorId: string
  type: PostType
  body: string | null
  photoPath: string | null
  movie: MovieRef | null
  rating: number | null
  activityMeta: ActivityMeta | null
  createdAt: string
}

/** Momento do diário do espaço — foto(s) + legenda + data do acontecido. */
export interface Moment {
  id: string
  coupleId: string
  authorId: string
  caption: string | null
  happenedOn: string // 'YYYY-MM-DD'
  photoPaths: string[]
  createdAt: string
}

export type PremiumPlan = 'weekly' | 'monthly' | 'lifetime'

/** Estado premium do espaço — espelho do get_entitlement() do banco. */
export interface Entitlement {
  isPremium: boolean
  trialEndsAt: string | null
  plan: PremiumPlan | null
  status: string | null
  isLifetime: boolean
  currentPeriodEnd: string | null
  priceAmount: number | null
  currency: string | null
  cancelAtPeriodEnd: boolean
}

export interface Comment {
  id: string
  postId: string
  authorId: string
  body: string
  createdAt: string
}

export interface Reaction {
  id: string
  postId: string
  authorId: string
  emoji: string
  createdAt: string
}
