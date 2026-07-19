import type { FavoriteRepository } from '../repositories'
import type { Favorite, MovieRef } from '../../domain/types'
import { supabase } from './client'
import { mapFavorite } from './mappers'
import { upsertMovieCache } from './SupabaseListRepository'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) throw new Error('Sem sessão')
  return uid
}

export class SupabaseFavoriteRepository implements FavoriteRepository {
  async getFavorites(profileId: string): Promise<Favorite[]> {
    const { data, error } = await supabase
      .from('favorites')
      .select('*, movies(*)')
      .eq('profile_id', profileId)
      .order('position', { ascending: true })
    if (error) throw error
    return data.map(mapFavorite)
  }

  async addFavorite(coupleId: string, movie: MovieRef, position: number): Promise<Favorite> {
    const uid = await currentUserId()
    await upsertMovieCache(movie)
    const { data, error } = await supabase
      .from('favorites')
      .insert({ profile_id: uid, couple_id: coupleId, tmdb_id: movie.tmdbId, position })
      .select('*, movies(*)')
      .single()
    if (error) throw error
    return mapFavorite(data)
  }

  async removeFavorite(tmdbId: number): Promise<void> {
    const uid = await currentUserId()
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('profile_id', uid)
      .eq('tmdb_id', tmdbId)
    if (error) throw error
  }
}
