import type {
  AuthUser,
  Comment,
  Couple,
  Entitlement,
  Favorite,
  ListItem,
  Moment,
  MovieList,
  MovieRef,
  Post,
  PremiumPlan,
  Profile,
  Reaction,
  Unsubscribe,
} from '../domain/types'

export interface AuthRepository {
  signUp(email: string, password: string, displayName: string): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  getCurrentUser(): Promise<AuthUser | null>
  onAuthStateChange(cb: (user: AuthUser | null) => void): Unsubscribe
}

export interface CoupleRepository {
  getMyProfile(): Promise<Profile | null>
  createCouple(): Promise<Couple>
  joinCouple(inviteCode: string): Promise<Couple>
  getCouple(): Promise<{ couple: Couple; members: Profile[] } | null>
  updateDisplayName(name: string): Promise<void>
  updateAvatar(path: string): Promise<void>
  leaveCouple(): Promise<void>
  requestAccountDeletion(): Promise<void>
  cancelAccountDeletion(): Promise<void>
}

export interface ListRepository {
  getLists(coupleId: string): Promise<MovieList[]>
  createList(coupleId: string, name: string): Promise<MovieList>
  renameList(listId: string, name: string): Promise<void>
  deleteList(listId: string): Promise<void>
  getItems(listId: string): Promise<ListItem[]>
  addItem(listId: string, listName: string, movie: MovieRef): Promise<void>
  removeItem(itemId: string): Promise<void>
  setWatched(itemId: string, watched: boolean): Promise<void>
  getListsContaining(coupleId: string, tmdbId: number): Promise<{ listId: string; name: string }[]>
}

export interface FeedPage {
  items: Post[]
  nextCursor?: string
}

export interface FeedRepository {
  getFeedPage(coupleId: string, cursor?: string, limit?: number, authorId?: string): Promise<FeedPage>
  getMemberReviews(coupleId: string, authorId: string, limit?: number): Promise<Post[]>
  createPost(input: { coupleId: string; body: string; photoPath?: string }): Promise<Post>
  createReview(input: { coupleId: string; movie: MovieRef; rating: number; body: string }): Promise<Post>
  getPost(postId: string): Promise<Post>
  deletePost(postId: string): Promise<void>
  updateReview(postId: string, rating: number, body: string): Promise<void>
  getMovieReviews(coupleId: string, tmdbId: number): Promise<Post[]>
  getReviewStats(coupleId: string): Promise<{ authorId: string; rating: number; createdAt: string }[]>
  getComments(postId: string): Promise<Comment[]>
  getCommentCounts(postIds: string[]): Promise<Record<string, number>>
  addComment(postId: string, body: string): Promise<Comment>
  toggleReaction(postId: string, emoji: string): Promise<void>
  getReactions(postIds: string[]): Promise<Record<string, Reaction[]>>
  subscribeToCouple?(coupleId: string, onChange: (table: string) => void): Unsubscribe
}

export interface FavoriteRepository {
  getFavorites(profileId: string): Promise<Favorite[]>
  addFavorite(coupleId: string, movie: MovieRef, position: number): Promise<Favorite>
  removeFavorite(tmdbId: number): Promise<void>
}

export interface MomentRepository {
  getMoments(coupleId: string): Promise<Moment[]>
  createMoment(input: {
    coupleId: string
    caption: string | null
    happenedOn: string
    photoPaths: string[]
  }): Promise<Moment>
  deleteMoment(momentId: string): Promise<void>
}

export interface StorageRepository {
  uploadPhoto(coupleId: string, file: Blob): Promise<string>
  getPhotoUrl(path: string): Promise<string>
}

export interface BillingRepository {
  getEntitlement(): Promise<Entitlement>
  /** Sessão de Embedded Checkout — o client monta o form num modal. */
  createCheckoutSession(plan: PremiumPlan): Promise<{ clientSecret: string }>
  /** Cancela no fim do período já pago (cancel_at_period_end). */
  cancelSubscription(): Promise<void>
  /** Desfaz o cancelamento antes do fim do período. */
  resumeSubscription(): Promise<void>
  /** Customer Portal — só para trocar forma de pagamento. */
  openPortal(): Promise<{ url: string }>
}

export interface Repositories {
  auth: AuthRepository
  couple: CoupleRepository
  lists: ListRepository
  feed: FeedRepository
  favorites: FavoriteRepository
  moments: MomentRepository
  storage: StorageRepository
  billing: BillingRepository
}
