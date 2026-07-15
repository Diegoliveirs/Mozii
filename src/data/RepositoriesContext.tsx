import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { Repositories } from './repositories'

const RepositoriesContext = createContext<Repositories | null>(null)

export function RepositoriesProvider({
  repositories,
  children,
}: {
  repositories: Repositories
  children: ReactNode
}) {
  return (
    <RepositoriesContext.Provider value={repositories}>{children}</RepositoriesContext.Provider>
  )
}

export function useRepositories(): Repositories {
  const repos = useContext(RepositoriesContext)
  if (!repos) throw new Error('useRepositories precisa de RepositoriesProvider')
  return repos
}
