import type { AuthRepository } from '../repositories'
import type { AuthUser, Unsubscribe } from '../../domain/types'
import { supabase } from './client'

export class SupabaseAuthRepository implements AuthRepository {
  async signUp(email: string, password: string, displayName: string): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) throw error
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    return user ? { id: user.id, email: user.email ?? '' } : null
  }

  onAuthStateChange(cb: (user: AuthUser | null) => void): Unsubscribe {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      cb(user ? { id: user.id, email: user.email ?? '' } : null)
    })
    return () => data.subscription.unsubscribe()
  }
}
