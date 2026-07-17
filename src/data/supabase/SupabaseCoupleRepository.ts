import type { CoupleRepository } from '../repositories'
import type { Couple, Profile } from '../../domain/types'
import { supabase } from './client'
import { mapCouple, mapProfile } from './mappers'

export class SupabaseCoupleRepository implements CoupleRepository {
  async getMyProfile(): Promise<Profile | null> {
    const { data: session } = await supabase.auth.getSession()
    const uid = session.session?.user.id
    if (!uid) return null
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    if (error) throw error
    return data ? mapProfile(data) : null
  }

  async createCouple(): Promise<Couple> {
    const { data, error } = await supabase.rpc('create_couple')
    if (error) throw error
    return mapCouple(data)
  }

  async joinCouple(inviteCode: string): Promise<Couple> {
    const { data, error } = await supabase.rpc('join_couple', { code: inviteCode })
    if (error) throw error
    // código inválido não gera exception (para o rate-limit do banco persistir a
    // tentativa — ver 010_hardening.sql). Conforme a versão do PostgREST isso
    // volta como null OU como um composite de campos nulos ({id:null,...}), então
    // detectamos pela ausência de id em vez de !data.
    if (!data?.id) throw new Error('Código inválido')
    return mapCouple(data)
  }

  async getCouple(): Promise<{ couple: Couple; members: Profile[] } | null> {
    const profile = await this.getMyProfile()
    if (!profile?.coupleId) return null
    const [coupleRes, membersRes] = await Promise.all([
      supabase.from('couples').select('*').eq('id', profile.coupleId).single(),
      supabase.from('profiles').select('*').eq('couple_id', profile.coupleId),
    ])
    if (coupleRes.error) throw coupleRes.error
    if (membersRes.error) throw membersRes.error
    return { couple: mapCouple(coupleRes.data), members: membersRes.data.map(mapProfile) }
  }

  async updateDisplayName(name: string): Promise<void> {
    const { data: session } = await supabase.auth.getSession()
    const uid = session.session?.user.id
    if (!uid) throw new Error('Sem sessão')
    const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', uid)
    if (error) throw error
  }

  async leaveCouple(): Promise<void> {
    const { error } = await supabase.rpc('leave_couple')
    if (error) throw error
  }

  async requestAccountDeletion(): Promise<void> {
    const { error } = await supabase.rpc('request_account_deletion')
    if (error) throw error
  }

  async cancelAccountDeletion(): Promise<void> {
    const { error } = await supabase.rpc('cancel_account_deletion')
    if (error) throw error
  }

  async updateAvatar(path: string): Promise<void> {
    const { data: session } = await supabase.auth.getSession()
    const uid = session.session?.user.id
    if (!uid) throw new Error('Sem sessão')
    const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', uid)
    if (error) throw error
  }
}
