import type { FeedPage, FeedRepository } from '../repositories'
import type { Comment, MovieRef, Post, Reaction, Unsubscribe } from '../../domain/types'
import { supabase } from './client'
import { mapComment, mapPost, mapReaction } from './mappers'
import { upsertMovieCache } from './SupabaseListRepository'

const POST_SELECT = '*, movies(*)'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) throw new Error('Sem sessão')
  return uid
}

export class SupabaseFeedRepository implements FeedRepository {
  async getFeedPage(coupleId: string, cursor?: string, limit = 20): Promise<FeedPage> {
    let query = supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (cursor) query = query.lt('created_at', cursor)
    const { data, error } = await query
    if (error) throw error
    const items = data.map(mapPost)
    return {
      items,
      nextCursor: items.length === limit ? items[items.length - 1].createdAt : undefined,
    }
  }

  async createPost(input: { coupleId: string; body: string; photoPath?: string }): Promise<Post> {
    const uid = await currentUserId()
    const { data, error } = await supabase
      .from('posts')
      .insert({
        couple_id: input.coupleId,
        author_id: uid,
        type: 'post',
        body: input.body || null,
        photo_path: input.photoPath ?? null,
      })
      .select(POST_SELECT)
      .single()
    if (error) throw error
    return mapPost(data)
  }

  async createReview(input: {
    coupleId: string
    movie: MovieRef
    rating: number
    body: string
  }): Promise<Post> {
    const uid = await currentUserId()
    await upsertMovieCache(input.movie)
    const { data, error } = await supabase
      .from('posts')
      .insert({
        couple_id: input.coupleId,
        author_id: uid,
        type: 'review',
        body: input.body || null,
        tmdb_id: input.movie.tmdbId,
        rating: input.rating,
      })
      .select(POST_SELECT)
      .single()
    if (error) throw error
    return mapPost(data)
  }

  async getPost(postId: string): Promise<Post> {
    const { data, error } = await supabase.from('posts').select(POST_SELECT).eq('id', postId).single()
    if (error) throw error
    return mapPost(data)
  }

  async deletePost(postId: string): Promise<void> {
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) throw error
  }

  async updateReview(postId: string, rating: number, body: string): Promise<void> {
    const { error } = await supabase
      .from('posts')
      .update({ rating, body: body || null })
      .eq('id', postId)
    if (error) throw error
  }

  async getMovieReviews(coupleId: string, tmdbId: number): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('couple_id', coupleId)
      .eq('type', 'review')
      .eq('tmdb_id', tmdbId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data.map(mapPost)
  }

  async getReviewStats(
    coupleId: string,
  ): Promise<{ authorId: string; rating: number; createdAt: string }[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('author_id, rating, created_at')
      .eq('couple_id', coupleId)
      .eq('type', 'review')
    if (error) throw error
    return data.map((row) => ({
      authorId: row.author_id as string,
      rating: Number(row.rating),
      createdAt: row.created_at as string,
    }))
  }

  async getComments(postId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data.map(mapComment)
  }

  async getCommentCounts(postIds: string[]): Promise<Record<string, number>> {
    if (postIds.length === 0) return {}
    const { data, error } = await supabase
      .from('comments')
      .select('post_id')
      .in('post_id', postIds)
    if (error) throw error
    const counts: Record<string, number> = {}
    for (const row of data) {
      const id = row.post_id as string
      counts[id] = (counts[id] ?? 0) + 1
    }
    return counts
  }

  async addComment(postId: string, body: string): Promise<Comment> {
    const uid = await currentUserId()
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, author_id: uid, body })
      .select('*')
      .single()
    if (error) throw error
    return mapComment(data)
  }

  async toggleReaction(postId: string, emoji: string): Promise<void> {
    const uid = await currentUserId()
    const { data: existing, error: selectError } = await supabase
      .from('reactions')
      .select('id')
      .eq('post_id', postId)
      .eq('author_id', uid)
      .eq('emoji', emoji)
      .maybeSingle()
    if (selectError) throw selectError
    if (existing) {
      const { error } = await supabase.from('reactions').delete().eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('reactions')
        .insert({ post_id: postId, author_id: uid, emoji })
      if (error) throw error
    }
  }

  async getReactions(postIds: string[]): Promise<Record<string, Reaction[]>> {
    if (postIds.length === 0) return {}
    const { data, error } = await supabase.from('reactions').select('*').in('post_id', postIds)
    if (error) throw error
    const grouped: Record<string, Reaction[]> = {}
    for (const row of data) {
      const reaction = mapReaction(row)
      ;(grouped[reaction.postId] ??= []).push(reaction)
    }
    return grouped
  }

  subscribeToCouple(coupleId: string, onChange: (table: string) => void): Unsubscribe {
    // posts/lists têm couple_id — filtro no canal. comments/reactions/list_items
    // não têm a coluna: canal sem filtro, a RLS de SELECT escopa a entrega.
    let channel = supabase.channel(`couple-${coupleId}`)
    const tables: { table: string; filter?: string }[] = [
      { table: 'posts', filter: `couple_id=eq.${coupleId}` },
      { table: 'lists', filter: `couple_id=eq.${coupleId}` },
      { table: 'comments' },
      { table: 'reactions' },
      { table: 'list_items' },
    ]
    for (const { table, filter } of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        () => onChange(table),
      )
    }
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }
}
