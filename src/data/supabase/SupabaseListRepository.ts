import type { ListRepository } from '../repositories'
import type { ListItem, MovieList, MovieRef } from '../../domain/types'
import { supabase } from './client'
import { mapList, mapListItem } from './mappers'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) throw new Error('Sem sessão')
  return uid
}

export async function upsertMovieCache(movie: MovieRef): Promise<void> {
  // escrita direta em movies foi revogada (010_hardening) — upsert via RPC validada
  const { error } = await supabase.rpc('upsert_movie', {
    p_tmdb_id: movie.tmdbId,
    p_title: movie.title,
    p_poster_path: movie.posterPath,
    p_release_year: movie.releaseYear,
    p_overview: movie.overview,
  })
  if (error) throw error
}

export class SupabaseListRepository implements ListRepository {
  async getLists(coupleId: string): Promise<MovieList[]> {
    const { data, error } = await supabase
      .from('lists')
      .select('*, list_items(watched, movies(poster_path))')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data.map(mapList)
  }

  async createList(coupleId: string, name: string): Promise<MovieList> {
    const uid = await currentUserId()
    const { data, error } = await supabase
      .from('lists')
      .insert({ couple_id: coupleId, name, created_by: uid })
      .select('*')
      .single()
    if (error) throw error
    return mapList({ ...data, list_items: [] })
  }

  async renameList(listId: string, name: string): Promise<void> {
    const { error } = await supabase.from('lists').update({ name }).eq('id', listId)
    if (error) throw error
  }

  async deleteList(listId: string): Promise<void> {
    const { error } = await supabase.from('lists').delete().eq('id', listId)
    if (error) throw error
  }

  async getItems(listId: string): Promise<ListItem[]> {
    const { data, error } = await supabase
      .from('list_items')
      .select('*, movies(*)')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data.map(mapListItem)
  }

  async addItem(listId: string, listName: string, movie: MovieRef): Promise<void> {
    const uid = await currentUserId()
    await upsertMovieCache(movie)

    const { error } = await supabase
      .from('list_items')
      .insert({ list_id: listId, tmdb_id: movie.tmdbId, added_by: uid })
    if (error) throw error

    const { data: list } = await supabase.from('lists').select('couple_id').eq('id', listId).single()
    if (list) {
      // atividade gerada no client (não em trigger) para portar 1:1 ao Firebase
      await supabase.from('posts').insert({
        couple_id: list.couple_id,
        author_id: uid,
        type: 'activity',
        tmdb_id: movie.tmdbId,
        activity_meta: { kind: 'list_add', list_id: listId, list_name: listName, movie_title: movie.title },
      })
    }
  }

  async removeItem(itemId: string): Promise<void> {
    const { error } = await supabase.from('list_items').delete().eq('id', itemId)
    if (error) throw error
  }

  async setWatched(itemId: string, watched: boolean): Promise<void> {
    const { error } = await supabase.from('list_items').update({ watched }).eq('id', itemId)
    if (error) throw error
  }

  async getListsContaining(
    coupleId: string,
    tmdbId: number,
  ): Promise<{ listId: string; name: string }[]> {
    const { data, error } = await supabase
      .from('lists')
      .select('id, name, list_items!inner(tmdb_id)')
      .eq('couple_id', coupleId)
      .eq('list_items.tmdb_id', tmdbId)
    if (error) throw error
    return data.map((row) => ({ listId: row.id, name: row.name }))
  }
}
