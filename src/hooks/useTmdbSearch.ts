import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMovie, searchMovies } from '../api/tmdb'

export function useDebounced<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export function useTmdbSearch(query: string) {
  const debounced = useDebounced(query)
  return useQuery({
    queryKey: ['tmdb-search', debounced],
    queryFn: () => searchMovies(debounced),
    enabled: debounced.trim().length > 1,
    staleTime: 5 * 60_000,
  })
}

export function useTmdbMovie(tmdbId: number) {
  return useQuery({
    queryKey: ['tmdb-movie', tmdbId],
    queryFn: () => getMovie(tmdbId),
    enabled: Number.isFinite(tmdbId),
    staleTime: 30 * 60_000,
  })
}
