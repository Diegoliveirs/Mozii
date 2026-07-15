import type { StorageRepository } from '../repositories'
import { supabase } from './client'

const BUCKET = 'post-photos'

export class SupabaseStorageRepository implements StorageRepository {
  async uploadPhoto(coupleId: string, file: Blob): Promise<string> {
    const path = `${coupleId}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: 'image/jpeg' })
    if (error) throw error
    return path
  }

  async getPhotoUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
    if (error) throw error
    return data.signedUrl
  }
}
