import { useEffect, useState } from 'react'
import type { AuthUser } from '../domain/types'
import { useRepositories } from '../data/RepositoriesContext'

export interface AuthState {
  user: AuthUser | null
  loading: boolean
}

export function useAuth(): AuthState {
  const { auth } = useRepositories()
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    let active = true
    auth.getCurrentUser().then((user) => {
      if (active) setState({ user, loading: false })
    })
    const unsubscribe = auth.onAuthStateChange((user) => {
      if (active) setState({ user, loading: false })
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [auth])

  return state
}
