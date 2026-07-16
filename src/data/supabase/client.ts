import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local')
}

export const supabase = createClient(url, anonKey)

// com RLS, postgres_changes só entrega eventos se o socket realtime tiver o
// JWT do usuário — o client não repassa sozinho nas trocas de sessão
supabase.auth.onAuthStateChange((_event, session) => {
  supabase.realtime.setAuth(session?.access_token ?? null)
})
