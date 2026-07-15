import type { MovieRef } from '../domain/types'

const BASE_URL = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'
const apiKey = import.meta.env.VITE_TMDB_API_KEY as string

interface TmdbMovie {
  id: number
  title: string
  poster_path: string | null
  release_date: string | null
  overview: string | null
}

function toMovieRef(m: TmdbMovie): MovieRef {
  return {
    tmdbId: m.id,
    title: m.title,
    posterPath: m.poster_path,
    releaseYear: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    overview: m.overview || null,
  }
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('language', 'pt-BR')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}

export async function searchMovies(query: string): Promise<MovieRef[]> {
  if (!query.trim()) return []
  const data = await get<{ results: TmdbMovie[] }>('/search/movie', { query, include_adult: 'false' })
  return data.results.map(toMovieRef)
}

export async function getMovie(
  tmdbId: number,
): Promise<MovieRef & { runtime: number | null; genres: string[]; backdropPath: string | null }> {
  const m = await get<
    TmdbMovie & { runtime: number | null; genres: { name: string }[]; backdrop_path: string | null }
  >(`/movie/${tmdbId}`)
  return {
    ...toMovieRef(m),
    runtime: m.runtime ?? null,
    genres: m.genres?.map((g) => g.name) ?? [],
    backdropPath: m.backdrop_path ?? null,
  }
}

export function backdropUrl(backdropPath: string | null): string | null {
  return backdropPath ? `${IMAGE_BASE}/w780${backdropPath}` : null
}

export function posterUrl(posterPath: string | null, size: 'w185' | 'w342' | 'w500' = 'w342'): string | null {
  return posterPath ? `${IMAGE_BASE}/${size}${posterPath}` : null
}
