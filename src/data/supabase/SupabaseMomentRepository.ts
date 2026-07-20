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
    const moment = mapMoment(data)

    // post-companheiro no feed: a memória vira um post 'moment' (reusa reações/comentários).
    // Se falhar, desfaz a memória para não deixar órfã sem presença no feed.
    const { error: postError } = await supabase.from('posts').insert({
      couple_id: input.coupleId,
      author_id: uid,
      type: 'moment',
      body: input.caption,
      activity_meta: { moment_id: moment.id, photo_paths: input.photoPaths },
      created_at: moment.createdAt,
    })
    if (postError) {
      await supabase.from('moments').delete().eq('id', moment.id)
      throw postError
    }
    return moment
  }

  async deleteMoment(momentId: string): Promise<void> {
    // limpeza best-effort das fotos no Storage — não bloqueia a exclusão da linha
    try {
      const { data: row } = await supabase
        .from('moments')
        .select('photo_paths')
        .eq('id', momentId)
        .single()
      const paths: string[] = row?.photo_paths ?? []
      if (paths.length) await supabase.storage.from('post-photos').remove(paths)
    } catch {
      // órfãos no Storage não quebram nada; a exclusão da memória segue
    }
    // remove o post-companheiro (cascata leva reações e comentários dele)
    await supabase
      .from('posts')
      .delete()
      .eq('type', 'moment')
      .eq('activity_meta->>moment_id', momentId)
    const { error } = await supabase.from('moments').delete().eq('id', momentId)
    if (error) throw error
  }
}
