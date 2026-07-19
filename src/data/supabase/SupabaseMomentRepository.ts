import type { MomentRepository } from '../repositories'
import type { Moment } from '../../domain/types'
import { supabase } from './client'
import { mapMoment } from './mappers'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) throw new Error('Sem sessão')
  return uid
}

export class SupabaseMomentRepository implements MomentRepository {
  async getMoments(coupleId: string): Promise<Moment[]> {
    const { data, error } = await supabase
      .from('moments')
      .select('*')
      .eq('couple_id', coupleId)
      .order('happened_on', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return data.map(mapMoment)
  }

  async createMoment(input: {
    coupleId: string
    caption: string | null
    happenedOn: string
    photoPaths: string[]
  }): Promise<Moment> {
    const uid = await currentUserId()
    const { data, error } = await supabase
      .from('moments')
      .insert({
        couple_id: input.coupleId,
        author_id: uid,
        caption: input.caption,
        happened_on: input.happenedOn,
        photo_paths: input.photoPaths,
      })
      .select('*')
      .single()
    if (error) throw error
    return mapMoment(data)
  }

  async deleteMoment(momentId: string): Promise<void> {
    const { error } = await supabase.from('moments').delete().eq('id', momentId)
    if (error) throw error
  }
}
