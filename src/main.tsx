import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { RepositoriesProvider } from './data/RepositoriesContext'
import { createSupabaseRepositories } from './data/supabase'
import { lockZoom } from './lib/lockZoom'

lockZoom()

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

function MissingEnv() {
  return (
    <div style={{ padding: 32, fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8 }}>
      <p>Configuração pendente. Crie o arquivo .env.local com:</p>
      <pre>
        VITE_SUPABASE_URL=…{'\n'}VITE_SUPABASE_ANON_KEY=…{'\n'}VITE_TMDB_API_KEY=…
      </pre>
      <p>Veja .env.example e supabase/migrations/.</p>
    </div>
  )
}

const hasEnv = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {hasEnv ? (
      <QueryClientProvider client={queryClient}>
        <RepositoriesProvider repositories={createSupabaseRepositories()}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RepositoriesProvider>
      </QueryClientProvider>
    ) : (
      <MissingEnv />
    )}
  </StrictMode>,
)
